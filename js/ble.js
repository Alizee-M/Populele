// Communication Bluetooth avec le Populele 1.
//
// SOURCE du protocole : projet Hackulele (licence Apache 2.0)
//   https://github.com/serdrad0x/Hackulele (commit 880859c, avril 2019)
//   - ABOUT.md, section « Bluetooth data » : format de la trame 19 octets, UUID dc86
//   - bluez.py : ordre des cordes G C E A, en-tête 0xF1, 6 octets de fin, puce Dialog (service fef5)
// Aucun code n'a été copié : le protocole a été réimplémenté en JavaScript (Web Bluetooth).
//
// Trame de 19 octets écrite sur la caractéristique 0000dc86-… :
//   F1 | G G G | C C C | E E E | A A A | 00 00 00 00 00 00
// Chaque corde = 24 bits, le bit de poids fort = LED la plus proche du sillet,
// seules les 18 premières LED existent (18 cases).

const CHAR_UUID = '0000dc86-0000-1000-8000-00805f9b34fb';
const DIALOG_SUOTA = '0000fef5-0000-1000-8000-00805f9b34fb';

export const NB_FRETS = 18;
export const STRINGS = ['G', 'C', 'E', 'A'];

function uuid16(n) {
  return '0000' + n.toString(16).padStart(4, '0') + '-0000-1000-8000-00805f9b34fb';
}

// On ne connaît pas le service qui contient dc86 : on autorise une large plage
// de services candidats, puis on cherche la caractéristique dans tous.
const CANDIDATE_SERVICES = (() => {
  const list = [DIALOG_SUOTA];
  for (let i = 0xdc00; i <= 0xdcff; i++) list.push(uuid16(i));
  for (const n of [0xfff0, 0xffe0, 0xffe5, 0xfee7, 0xfee9, 0x180a, 0x180f, 0x1801]) list.push(uuid16(n));
  return list;
})();

export class Populele extends EventTarget {
  constructor() {
    super();
    this.device = null;
    this.char = null;
    this.status = 'disconnected'; // disconnected | connecting | connected
    this.log = [];
    this._pending = null;
    this._writing = false;
    this._wantConnected = false;
    this.settings = { fretOffset: 0, reverseStrings: false, reverseFrets: false };
  }

  static isSupported() {
    return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
  }

  _setStatus(s, msg) {
    this.status = s;
    this.dispatchEvent(new CustomEvent('status', { detail: { status: s, message: msg || '' } }));
  }

  _log(msg) {
    this.log.push(new Date().toLocaleTimeString() + ' ' + msg);
    if (this.log.length > 200) this.log.shift();
    this.dispatchEvent(new CustomEvent('log', { detail: msg }));
  }

  async connect({ showAll = false } = {}) {
    if (!Populele.isSupported()) throw new Error('Bluetooth non disponible dans ce navigateur. Sur iPhone, utilise l’app Bluefy.');
    const opts = showAll
      ? { acceptAllDevices: true, optionalServices: CANDIDATE_SERVICES }
      : {
          filters: [
            { namePrefix: 'Popu' }, { namePrefix: 'popu' }, { namePrefix: 'POPU' },
            { services: [DIALOG_SUOTA] },
          ],
          optionalServices: CANDIDATE_SERVICES,
        };
    const device = await navigator.bluetooth.requestDevice(opts);
    this.device = device;
    this._wantConnected = true;
    device.addEventListener('gattserverdisconnected', () => this._onDisconnected());
    this._log('Appareil choisi : ' + (device.name || '(sans nom)'));
    await this._connectGatt();
  }

  async _connectGatt() {
    this._setStatus('connecting', 'Connexion…');
    const server = await this.device.gatt.connect();
    this._log('GATT connecté');
    const services = await server.getPrimaryServices();
    let found = null;
    for (const svc of services) {
      this._log('Service ' + svc.uuid);
      let chars = [];
      try { chars = await svc.getCharacteristics(); } catch (e) { continue; }
      for (const c of chars) {
        const p = c.properties;
        this._log('  car. ' + c.uuid + (p.write ? ' W' : '') + (p.writeWithoutResponse ? ' Wnr' : '') + (p.notify ? ' N' : ''));
        if (c.uuid.toLowerCase() === CHAR_UUID) found = c;
      }
    }
    if (!found) {
      this._setStatus('disconnected', 'Caractéristique LED introuvable');
      try { server.disconnect(); } catch (e) { /* rien */ }
      throw new Error('Connecté, mais la caractéristique des LEDs (dc86) est introuvable. Va dans Réglages > Journal et envoie-le à Alizée.');
    }
    this.char = found;
    this._setStatus('connected', this.device.name || 'Populele');
    if (this._lastFrame) this._queue(this._lastFrame);
  }

  async _onDisconnected() {
    this.char = null;
    this._log('Déconnecté');
    if (!this._wantConnected) { this._setStatus('disconnected'); return; }
    for (let attempt = 1; attempt <= 3 && this._wantConnected; attempt++) {
      this._setStatus('connecting', 'Reconnexion (' + attempt + '/3)…');
      await new Promise((r) => setTimeout(r, 800 * attempt));
      try { await this._connectGatt(); return; } catch (e) { this._log('Échec reconnexion : ' + e.message); }
    }
    this._setStatus('disconnected', 'Connexion perdue');
  }

  disconnect() {
    this._wantConnected = false;
    if (this.device && this.device.gatt.connected) this.device.gatt.disconnect();
    this.char = null;
    this._setStatus('disconnected');
  }

  // leds : liste de {string: 0..3 (0=G,1=C,2=E,3=A), led: 0..17 (0 = près du sillet)}
  static buildFrame(leds) {
    const frame = new Uint8Array(19);
    frame[0] = 0xf1;
    const vals = [0, 0, 0, 0];
    for (const { string, led } of leds) {
      if (string < 0 || string > 3 || led < 0 || led >= NB_FRETS) continue;
      vals[string] |= 1 << (23 - led);
    }
    for (let s = 0; s < 4; s++) {
      frame[1 + s * 3] = (vals[s] >> 16) & 0xff;
      frame[2 + s * 3] = (vals[s] >> 8) & 0xff;
      frame[3 + s * 3] = vals[s] & 0xff;
    }
    return frame;
  }

  // Convertit des positions musicales (corde, case) en LEDs selon le calibrage.
  // frets : tableau [G, C, E, A] de numéros de case (0 = corde à vide, -1 = non jouée)
  ledsForFrets(frets) {
    const { fretOffset, reverseStrings, reverseFrets } = this.settings;
    const leds = [];
    frets.forEach((f, s) => {
      if (f == null || f <= 0) return;
      let led = f - 1 + fretOffset;
      if (reverseFrets) led = NB_FRETS - 1 - led;
      leds.push({ string: reverseStrings ? 3 - s : s, led });
    });
    return leds;
  }

  showFrets(frets) { return this.showLeds(this.ledsForFrets(frets)); }

  showLeds(leds) {
    const frame = Populele.buildFrame(leds);
    this._lastFrame = frame;
    this._queue(frame);
  }

  clear() { this.showLeds([]); }

  // On n'envoie que la dernière trame demandée pour ne pas saturer la liaison.
  _queue(frame) {
    this._pending = frame;
    if (!this._writing) this._flush();
  }

  async _flush() {
    if (!this.char) return;
    this._writing = true;
    while (this._pending && this.char) {
      const f = this._pending;
      this._pending = null;
      try {
        if (this.char.writeValueWithoutResponse && this.char.properties.writeWithoutResponse) {
          await this.char.writeValueWithoutResponse(f);
        } else {
          await this.char.writeValue(f);
        }
      } catch (e) {
        this._log('Erreur écriture : ' + e.message);
      }
      await new Promise((r) => setTimeout(r, 60));
    }
    this._writing = false;
  }
}
