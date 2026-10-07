import React, { useState, useEffect } from 'react';
import { rcCommandClient, CloudRcStateSnapshot, RcCommandType } from '../../services/rcCommandClient';
import { Radio, AlertTriangle, ShieldAlert, Zap, Send, RotateCcw, Power, CheckCircle, XCircle } from 'lucide-react';

interface Props {
  isAirborne?: boolean;
  relativeAltitude?: number;
  currentFlightMode?: string;
}

const CHANNEL_LABELS: Record<number, { name: string; role: string; color: string }> = {
  1: { name: 'CH1: Roll', role: 'AIL', color: 'bg-cyan-500' },
  2: { name: 'CH2: Pitch', role: 'ELE', color: 'bg-cyan-500' },
  3: { name: 'CH3: Throttle', role: 'THR', color: 'bg-emerald-500' },
  4: { name: 'CH4: Yaw', role: 'RUD', color: 'bg-cyan-500' },
  5: { name: 'CH5: Flight Mode', role: 'MODE', color: 'bg-purple-500' },
  6: { name: 'CH6: Gimbal Pitch', role: 'AUX', color: 'bg-indigo-500' },
  7: { name: 'CH7: Arm Switch', role: 'ARM', color: 'bg-amber-500' },
  8: { name: 'CH8: Motor Kill', role: 'KILL', color: 'bg-red-500' },
  9: { name: 'CH9: Aux 1', role: 'AUX', color: 'bg-slate-500' },
  10: { name: 'CH10: Aux 2', role: 'AUX', color: 'bg-slate-500' },
  11: { name: 'CH11: Aux 3', role: 'AUX', color: 'bg-slate-500' },
  12: { name: 'CH12: Aux 4', role: 'AUX', color: 'bg-slate-500' },
  13: { name: 'CH13: Aux 5', role: 'AUX', color: 'bg-slate-500' },
  14: { name: 'CH14: Aux 6', role: 'AUX', color: 'bg-slate-500' },
  15: { name: 'CH15: Aux 7', role: 'AUX', color: 'bg-slate-500' },
  16: { name: 'CH16: Aux 8', role: 'AUX', color: 'bg-slate-500' }
};

export const RcControlPanel: React.FC<Props> = ({
  isAirborne = false,
  relativeAltitude = 0.0,
  currentFlightMode = 'UNKNOWN'
}) => {
  const [rcState, setRcState] = useState<CloudRcStateSnapshot | null>(null);
  const [selectedMode, setSelectedMode] = useState<string>('LOITER');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [lastActionStatus, setLastActionStatus] = useState<string | null>(null);
  const [showKillModal, setShowKillModal] = useState<boolean>(false);
  const [showDisarmModal, setShowDisarmModal] = useState<boolean>(false);
  const [killConfirmText, setKillConfirmText] = useState<string>('');

  useEffect(() => {
    // Start continuous state subscription & operator heartbeat
    const unsubscribe = rcCommandClient.subscribeState((newState) => {
      setRcState(newState);
    });
    rcCommandClient.startHeartbeat(1000);

    return () => {
      unsubscribe();
      rcCommandClient.stopHeartbeat();
    };
  }, []);

  const handleSendCommand = async (type: RcCommandType, params: Record<string, any> = {}) => {
    try {
      setIsSending(true);
      setLastActionStatus(`Sending ${type}...`);
      const record = await rcCommandClient.sendCommand(type, params);
      setLastActionStatus(`✓ ${type} dispatched [${record.status}]`);
    } catch (err: any) {
      setLastActionStatus(`✗ Error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleArm = () => {
    handleSendCommand('ARM');
  };

  const handleDisarm = () => {
    if (isAirborne || relativeAltitude > 0.4) {
      setShowDisarmModal(true);
    } else {
      handleSendCommand('DISARM', { confirm: true });
    }
  };

  const confirmAirborneDisarm = () => {
    setShowDisarmModal(false);
    handleSendCommand('DISARM', { confirm: true, reason: 'Operator confirmed airborne disarm' });
  };

  const handleEmergencyKill = () => {
    if (killConfirmText.trim().toUpperCase() === 'KILL') {
      setShowKillModal(false);
      setKillConfirmText('');
      handleSendCommand('KILL', { confirm: true, reason: 'EMERGENCY MOTOR CUT-OFF BY OPERATOR' });
    }
  };

  const isAgentOnline = Boolean(rcState?.agentOnline);
  const telemetry = rcState?.telemetry;
  const channels = telemetry?.channels || new Array(16).fill(1500);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md text-white space-y-5">
      {/* 1. Header & Link Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-lg tracking-wide flex items-center space-x-2">
              <span>RC-Bridge Control Layer</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                50 Hz Out-of-Band
              </span>
            </h3>
            <p className="text-xs text-slate-400">Deterministic transmitter channel injection & failsafe pipeline</p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700">
            <span className={`w-2 h-2 rounded-full ${isAgentOnline ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-red-500'}`} />
            <span className="font-semibold text-slate-200">{isAgentOnline ? 'AGENT ONLINE' : 'AGENT OFFLINE'}</span>
          </div>

          <div className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 font-mono text-slate-300">
            RTT: <span className="text-cyan-400 font-bold">{telemetry?.cloudRttMs || 0}ms</span>
          </div>

          <div className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 font-mono text-slate-300">
            Loop: <span className="text-purple-400 font-bold">{telemetry?.loopRateHz || 0} Hz</span>
          </div>
        </div>
      </div>

      {/* 2. Critical Safety Warning Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300 flex items-center space-x-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400" />
        <div>
          <span className="font-bold uppercase tracking-wider">Safety Pilot Primacy:</span> Human safety pilot must be ready with the physical RC transmitter. Flipping the hardware trainer override switch (e.g. Switch <code className="bg-amber-900/50 px-1 py-0.5 rounded font-mono">SA/SH</code>) instantly cuts laptop injection and restores manual stick control.
        </div>
      </div>

      {/* 3. Action Control Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: Flight Mode & Commands */}
        <div className="space-y-3 bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex justify-between items-center">
            <span>Flight Mode Selection</span>
            <span className="text-[11px] text-cyan-400 font-mono">Current: {currentFlightMode}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {['LOITER', 'ALT_HOLD', 'STABILIZE', 'AUTO', 'RTL', 'LAND'].map((mode) => (
              <button
                key={mode}
                disabled={!isAgentOnline || isSending}
                onClick={() => {
                  setSelectedMode(mode);
                  handleSendCommand('SET_MODE', { mode });
                }}
                className={`px-3 py-2 rounded text-xs font-bold transition-all border ${
                  selectedMode === mode
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-700/80 hover:text-white'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="pt-2 border-t border-slate-800/60 grid grid-cols-2 gap-2">
            <button
              disabled={!isAgentOnline || isSending}
              onClick={() => handleSendCommand('HOLD')}
              className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition-all disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>HOLD (Loiter)</span>
            </button>

            <button
              disabled={!isAgentOnline || isSending}
              onClick={() => handleSendCommand('RTL')}
              className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold transition-all disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              <span>RETURN TO LAUNCH</span>
            </button>
          </div>

          {/* Nudge Vector Matrix */}
          <div className="pt-2 border-t border-slate-800/60">
            <div className="text-[11px] text-slate-400 mb-1.5 font-medium">Momentary Nudge (500ms bounded offset)</div>
            <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
              <button
                disabled={!isAgentOnline || isSending}
                onClick={() => handleSendCommand('NUDGE', { axis: 'PITCH', direction: 'POS', magnitude: 0.5, durationMs: 500 })}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-200 disabled:opacity-40"
              >
                ▲ FWD
              </button>
              <button
                disabled={!isAgentOnline || isSending}
                onClick={() => handleSendCommand('NUDGE', { axis: 'PITCH', direction: 'NEG', magnitude: 0.5, durationMs: 500 })}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-200 disabled:opacity-40"
              >
                ▼ BACK
              </button>
              <button
                disabled={!isAgentOnline || isSending}
                onClick={() => handleSendCommand('NUDGE', { axis: 'ROLL', direction: 'NEG', magnitude: 0.5, durationMs: 500 })}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-200 disabled:opacity-40"
              >
                ◀ LEFT
              </button>
              <button
                disabled={!isAgentOnline || isSending}
                onClick={() => handleSendCommand('NUDGE', { axis: 'ROLL', direction: 'POS', magnitude: 0.5, durationMs: 500 })}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-200 disabled:opacity-40"
              >
                ▶ RIGHT
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: High-Severity Interlocks */}
        <div className="space-y-3 bg-slate-950/60 p-4 rounded-lg border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              High-Severity Flight Interlocks
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                disabled={!isAgentOnline || isSending}
                onClick={handleArm}
                className="flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-bold transition-all disabled:opacity-40 shadow-md"
              >
                <Power className="w-4 h-4" />
                <span>ARM MOTORS (CH7)</span>
              </button>

              <button
                disabled={!isAgentOnline || isSending}
                onClick={handleDisarm}
                className="flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-slate-800 hover:bg-red-800 text-slate-200 hover:text-white rounded text-xs font-bold transition-all border border-slate-700 disabled:opacity-40"
              >
                <XCircle className="w-4 h-4" />
                <span>DISARM MOTORS</span>
              </button>
            </div>

            <button
              disabled={!isAgentOnline || isSending}
              onClick={() => handleSendCommand('EMERGENCY_RTL')}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-lg text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-orange-900/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-40 mb-3"
            >
              <Zap className="w-4 h-4" />
              <span>EMERGENCY RTL (1685 us)</span>
            </button>
          </div>

          <div>
            <button
              disabled={!isAgentOnline}
              onClick={() => setShowKillModal(true)}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-xl shadow-red-950/60 border border-red-400 flex items-center justify-center space-x-2 transition-all disabled:opacity-30"
            >
              <ShieldAlert className="w-5 h-5 text-white animate-pulse" />
              <span>EMERGENCY MOTOR KILL (CH8)</span>
            </button>
            <p className="text-[10px] text-center text-slate-400 mt-1">
              Instant motor shutdown. Requires confirmation.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Live 16-Channel Graphical Bar Meters */}
      <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80 space-y-2.5">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-slate-300 uppercase tracking-wider">Live 16-Channel RC Output (Microseconds)</span>
          <span className="text-slate-400 font-mono text-[11px]">Center: 1500 us | Range: 1000 - 2000 us</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((ch) => {
            const pwm = channels[ch - 1] || 1500;
            const pct = Math.max(0, Math.min(100, ((pwm - 1000) / 1000) * 100));
            const meta = CHANNEL_LABELS[ch] || { name: `CH${ch}`, role: 'AUX', color: 'bg-slate-500' };

            return (
              <div key={ch} className="space-y-0.5 text-[11px]">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="font-medium text-slate-300">{meta.name}</span>
                  <span className="font-mono text-cyan-300">{pwm} us</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden relative border border-slate-700/50">
                  <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-500/50 z-10" />
                  <div
                    className={`h-full transition-all duration-75 ${meta.color}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Last Action Status Bar */}
      {lastActionStatus && (
        <div className="text-xs font-mono p-2.5 bg-slate-950 rounded border border-slate-800 text-slate-300 flex items-center justify-between">
          <span>{lastActionStatus}</span>
          <span className="text-[10px] text-slate-500">{new Date().toLocaleTimeString()}</span>
        </div>
      )}

      {/* MODAL 1: Airborne Disarm Safety Guard */}
      {showDisarmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border-2 border-red-500 rounded-xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-400">
              <ShieldAlert className="w-8 h-8 flex-shrink-0" />
              <h4 className="text-lg font-black tracking-wide">CONFIRM AIRBORNE DISARM</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              The aircraft is currently detected as <strong className="text-red-400">AIRBORNE</strong> at relative altitude <strong className="text-yellow-400">{relativeAltitude.toFixed(1)}m</strong>. Disarming the motors while airborne will cause the drone to fall immediately and crash.
            </p>
            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowDisarmModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold"
              >
                CANCEL (Keep Flying)
              </button>
              <button
                onClick={confirmAirborneDisarm}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-extrabold uppercase shadow-lg shadow-red-950/60"
              >
                YES, DISARM MOTORS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Emergency Motor Kill Confirmation */}
      {showKillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border-2 border-red-600 rounded-xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-500">
              <ShieldAlert className="w-8 h-8 flex-shrink-0 animate-bounce" />
              <h4 className="text-lg font-black tracking-wide">EMERGENCY MOTOR CUT-OFF (KILL)</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This commands an immediate hard motor emergency stop on <code className="text-yellow-400 bg-slate-800 px-1 py-0.5 rounded font-mono">CH8 (RC8_OPTION=31)</code>. The drone will lose all power instantly.
            </p>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Type <span className="text-red-400 font-bold">KILL</span> below to confirm:</label>
              <input
                type="text"
                value={killConfirmText}
                onChange={(e) => setKillConfirmText(e.target.value)}
                placeholder="Type KILL"
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-center font-mono font-bold tracking-widest text-red-400 focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  setShowKillModal(false);
                  setKillConfirmText('');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold"
              >
                ABORT
              </button>
              <button
                disabled={killConfirmText.trim().toUpperCase() !== 'KILL'}
                onClick={handleEmergencyKill}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-extrabold uppercase shadow-lg shadow-red-950/60 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                EXECUTE MOTOR KILL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
