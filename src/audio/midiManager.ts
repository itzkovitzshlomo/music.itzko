import { Lpk25Settings, MidiDeviceInfo, MidiMessageLog } from '../types/daw';

export type DirectMidiNoteHandler = (
  type: 'noteon' | 'noteoff',
  pitch: number,
  velocity: number,
  deviceName: string,
  channel: number
) => void;

export type MidiLogListener = (log: MidiMessageLog) => void;
export type MidiDevicesListener = (devices: MidiDeviceInfo[]) => void;

class MidiManager {
  private midiAccess: MIDIAccess | null = null;
  private devices: MidiDeviceInfo[] = [];
  private activeDeviceId: string | null = null; // null = listen to all connected MIDI inputs
  private settings: Lpk25Settings = {
    octaveOffset: 0,
    programBank: 1,
    arpEnabled: false,
    arpMode: 'up',
    arpRate: '1/8',
    arpOctaves: 1,
    arpLatch: false,
    sustainOn: false,
    velocityCurve: 'linear',
    qwertyEnabled: true,
  };

  private directHandler: DirectMidiNoteHandler | null = null;
  private deviceListeners = new Set<MidiDevicesListener>();
  private logListeners = new Set<MidiLogListener>();

  // Arpeggiator & Sustain state
  private heldKeys = new Set<number>();
  private sustainedNotes = new Set<number>();
  private arpTimer: number | null = null;
  private arpStep = 0;
  private arpLastPitch: number | null = null;
  private currentBpm = 120;

  public async initialize(): Promise<{ supported: boolean; devices: MidiDeviceInfo[]; error?: string }> {
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
      return { supported: false, devices: [], error: 'הדפדפן אינו תומך ב-Web MIDI API (השתמש ב-Chrome / Edge)' };
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.midiAccess.onstatechange = () => {
        this.refreshDevices();
      };
      this.refreshDevices();
      return { supported: true, devices: this.devices };
    } catch (err) {
      return {
        supported: false,
        devices: [],
        error: err instanceof Error ? err.message : 'גישה ל-MIDI נדחתה',
      };
    }
  }

  public setDirectHandler(handler: DirectMidiNoteHandler | null) {
    this.directHandler = handler;
  }

  public setBpm(bpm: number) {
    this.currentBpm = Math.max(40, Math.min(240, bpm));
    if (this.settings.arpEnabled && this.heldKeys.size > 0) {
      this.restartArpLoop();
    }
  }

  public updateSettings(partial: Partial<Lpk25Settings>) {
    const prevSustain = this.settings.sustainOn;
    const prevArp = this.settings.arpEnabled;
    this.settings = { ...this.settings, ...partial };

    if (prevSustain && !this.settings.sustainOn) {
      // Release sustained notes
      for (const pitch of this.sustainedNotes) {
        if (!this.heldKeys.has(pitch)) {
          this.emitNote('noteoff', pitch, 0, 'Sustain', 1);
        }
      }
      this.sustainedNotes.clear();
    }

    if (prevArp && !this.settings.arpEnabled) {
      this.stopArpLoop();
    } else if (this.settings.arpEnabled && this.heldKeys.size > 0) {
      this.restartArpLoop();
    }
  }

  public getSettings(): Lpk25Settings {
    return this.settings;
  }

  public setActiveDeviceId(id: string | null) {
    this.activeDeviceId = id;
  }

  public getDevices(): MidiDeviceInfo[] {
    return this.devices;
  }

  public subscribeDevices(cb: MidiDevicesListener): () => void {
    this.deviceListeners.add(cb);
    cb(this.devices);
    return () => this.deviceListeners.delete(cb);
  }

  public subscribeLogs(cb: MidiLogListener): () => void {
    this.logListeners.add(cb);
    return () => this.logListeners.delete(cb);
  }

  private refreshDevices() {
    if (!this.midiAccess) return;
    const list: MidiDeviceInfo[] = [];

    this.midiAccess.inputs.forEach((input) => {
      const name = input.name || 'USB MIDI Keyboard';
      const manufacturer = input.manufacturer || 'Generic';
      const isLpk25 = /lpk\s*25|akai/i.test(`${name} ${manufacturer}`);

      list.push({
        id: input.id,
        name,
        manufacturer,
        state: input.state === 'connected' ? 'connected' : 'disconnected',
        isLpk25,
      });

      // Attach direct low-latency handler directly to the MIDIInput port
      input.onmidimessage = (event) => {
        if (this.activeDeviceId && this.activeDeviceId !== input.id) return;
        this.handleRawMidiMessage(event, name, isLpk25);
      };
    });

    // Prioritize Akai LPK25 at top of device list
    list.sort((a, b) => Number(b.isLpk25) - Number(a.isLpk25));
    this.devices = list;

    for (const cb of this.deviceListeners) {
      cb(list);
    }
  }

  private shapeVelocity(rawVel: number): number {
    const norm = Math.max(0, Math.min(1, rawVel / 127));
    switch (this.settings.velocityCurve) {
      case 'soft':
        return Math.max(1, Math.round(Math.pow(norm, 0.65) * 127));
      case 'hard':
        return Math.max(1, Math.round(Math.pow(norm, 1.6) * 127));
      case 'fixed100':
        return 100;
      case 'linear':
      default:
        return Math.max(1, rawVel);
    }
  }

  private handleRawMidiMessage(event: MIDIMessageEvent, deviceName: string, _isLpk25: boolean) {
    const data = event.data;
    if (!data || data.length < 2) return;

    const status = data[0] & 0xf0;
    const channel = (data[0] & 0x0f) + 1;
    const d1 = data[1];
    const d2 = data.length > 2 ? data[2] : 0;

    if (status === 0x90 && d2 > 0) {
      const pitch = Math.max(0, Math.min(127, d1));
      const velocity = this.shapeVelocity(d2);
      this.triggerInputNoteOn(pitch, velocity, deviceName, channel);
    } else if (status === 0x80 || (status === 0x90 && d2 === 0)) {
      const pitch = Math.max(0, Math.min(127, d1));
      this.triggerInputNoteOff(pitch, deviceName, channel);
    } else if (status === 0xb0) {
      // Sustain Pedal CC 64
      if (d1 === 64) {
        const down = d2 >= 64;
        this.updateSettings({ sustainOn: down });
      } else if (d1 === 123 || d1 === 120) {
        // All Notes Off / All Sound Off
        this.panic();
      }
      this.pushLog({
        timestamp: performance.now(),
        deviceName,
        type: 'cc',
        cc: d1,
        value: d2,
        channel,
      });
    } else if (status === 0xe0) {
      const bend = ((d2 << 7) | d1) - 8192;
      this.pushLog({
        timestamp: performance.now(),
        deviceName,
        type: 'pitchbend',
        value: bend,
        channel,
      });
    }
  }

  public triggerVirtualNoteOn(pitch: number, velocity = 100) {
    this.triggerInputNoteOn(pitch, this.shapeVelocity(velocity), 'LPK25 Virtual', 1);
  }

  public triggerVirtualNoteOff(pitch: number) {
    this.triggerInputNoteOff(pitch, 'LPK25 Virtual', 1);
  }

  private triggerInputNoteOn(pitch: number, velocity: number, deviceName: string, channel: number) {
    if (this.settings.arpEnabled) {
      if (this.settings.arpLatch && this.heldKeys.size === 0) {
        this.heldKeys.clear();
      }
      this.heldKeys.add(pitch);
      if (this.arpTimer === null) {
        this.arpStep = 0;
        this.restartArpLoop();
      }
      this.pushLog({ timestamp: performance.now(), deviceName, type: 'noteon', note: pitch, velocity, channel });
      return;
    }

    this.heldKeys.add(pitch);
    this.emitNote('noteon', pitch, velocity, deviceName, channel);
  }

  private triggerInputNoteOff(pitch: number, deviceName: string, channel: number) {
    if (this.settings.arpEnabled) {
      if (!this.settings.arpLatch) {
        this.heldKeys.delete(pitch);
        if (this.heldKeys.size === 0) {
          this.stopArpLoop();
        }
      }
      this.pushLog({ timestamp: performance.now(), deviceName, type: 'noteoff', note: pitch, velocity: 0, channel });
      return;
    }

    this.heldKeys.delete(pitch);
    if (this.settings.sustainOn) {
      this.sustainedNotes.add(pitch);
      return;
    }
    this.emitNote('noteoff', pitch, 0, deviceName, channel);
  }

  private emitNote(
    type: 'noteon' | 'noteoff',
    pitch: number,
    velocity: number,
    deviceName: string,
    channel: number
  ) {
    if (this.directHandler) {
      this.directHandler(type, pitch, velocity, deviceName, channel);
    }
    this.pushLog({
      timestamp: performance.now(),
      deviceName,
      type,
      note: pitch,
      velocity,
      channel,
    });
  }

  private pushLog(log: MidiMessageLog) {
    for (const cb of this.logListeners) {
      cb(log);
    }
  }

  private getArpIntervalMs(): number {
    const beatMs = 60000 / this.currentBpm;
    switch (this.settings.arpRate) {
      case '1/4':
        return beatMs;
      case '1/8':
        return beatMs / 2;
      case '1/16':
        return beatMs / 4;
      case '1/32':
        return beatMs / 8;
      case '1/8T':
        return beatMs / 3;
      default:
        return beatMs / 2;
    }
  }

  private restartArpLoop() {
    this.stopArpLoop(false);
    const interval = Math.max(35, this.getArpIntervalMs());
    const tick = () => {
      if (!this.settings.arpEnabled || this.heldKeys.size === 0) {
        this.stopArpLoop();
        return;
      }
      if (this.arpLastPitch !== null) {
        this.emitNote('noteoff', this.arpLastPitch, 0, 'LPK25 Arp', 1);
        this.arpLastPitch = null;
      }

      const base = Array.from(this.heldKeys).sort((a, b) => a - b);
      const pool: number[] = [];
      for (let oct = 0; oct < this.settings.arpOctaves; oct++) {
        for (const n of base) {
          const p = n + oct * 12;
          if (p <= 127) pool.push(p);
        }
      }
      if (pool.length === 0) return;

      let chosen = pool[0];
      if (this.settings.arpMode === 'up') {
        chosen = pool[this.arpStep % pool.length];
      } else if (this.settings.arpMode === 'down') {
        const rev = [...pool].reverse();
        chosen = rev[this.arpStep % rev.length];
      } else if (this.settings.arpMode === 'up_down') {
        const bounce = pool.length > 1 ? [...pool, ...pool.slice(1, -1).reverse()] : pool;
        chosen = bounce[this.arpStep % bounce.length];
      } else if (this.settings.arpMode === 'random') {
        chosen = pool[Math.floor(Math.random() * pool.length)];
      }

      this.arpStep++;
      this.arpLastPitch = chosen;
      this.emitNote('noteon', chosen, 98, 'LPK25 Arp', 1);
    };

    tick();
    this.arpTimer = window.setInterval(tick, interval);
  }

  private stopArpLoop(clearHeld = false) {
    if (this.arpTimer !== null) {
      window.clearInterval(this.arpTimer);
      this.arpTimer = null;
    }
    if (this.arpLastPitch !== null) {
      this.emitNote('noteoff', this.arpLastPitch, 0, 'LPK25 Arp', 1);
      this.arpLastPitch = null;
    }
    if (clearHeld) {
      this.heldKeys.clear();
    }
  }

  public panic() {
    this.stopArpLoop(true);
    this.sustainedNotes.clear();
  }
}

export const midiManager = new MidiManager();

// QWERTY keyboard mapping aligned with 25-key Akai LPK25 layout (C3..E4 on lower & upper rows)
export const QWERTY_TO_SEMITONE_OFFSET: Record<string, number> = {
  z: 0, // C
  s: 1, // C#
  x: 2, // D
  d: 3, // D#
  c: 4, // E
  v: 5, // F
  g: 6, // F#
  b: 7, // G
  h: 8, // G#
  n: 9, // A
  j: 10, // A#
  m: 11, // B
  ',': 12, // C+1
  q: 12, // C+1
  '2': 13, // C#+1
  w: 14, // D+1
  '3': 15, // D#+1
  e: 16, // E+1
  r: 17, // F+1
  '5': 18, // F#+1
  t: 19, // G+1
  '6': 20, // G#+1
  y: 21, // A+1
  '7': 22, // A#+1
  u: 23, // B+1
  i: 24, // C+2
};

export function midiNumberToNoteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const oct = Math.floor(midi / 12) - 1;
  return `${names[midi % 12]}${oct}`;
}
