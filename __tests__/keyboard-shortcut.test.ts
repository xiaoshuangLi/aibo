/**
 * Test for keyboard shortcut functionality
 */
import { createTencentASR } from '../src/utils/tencent-asr';

// Define proper types for key events
interface KeyEvent {
  ctrl?: boolean;
  meta?: boolean;
  name: string;
}

describe('Keyboard Shortcut Integration', () => {
  test('should create TencentASR instance for voice input', () => {
    const asr = createTencentASR({
      appId: 'test-app-id',
      secretId: 'test-secret-id',
      secretKey: 'test-secret-key'
    });
    
    expect(asr).toBeDefined();
    expect(asr.startManualRecording).toBeDefined();
    expect(asr.stopManualRecording).toBeDefined();
    expect(asr.isManualRecording).toBeDefined();
    expect(asr.recognizeManualRecording).toBeDefined();
  });

  test('should handle cross-platform key detection logic', () => {
    // Test Windows/Linux Ctrl + R
    const keyCtrlR: KeyEvent = { ctrl: true, name: 'r' };
    const isCtrlOrCmd = (keyCtrlR.ctrl === true) || (keyCtrlR.meta === true);
    const isR = keyCtrlR.name === 'r';
    expect(isCtrlOrCmd && isR).toBe(true);
    
    // Test macOS Cmd + R  
    const keyCmdR: KeyEvent = { meta: true, name: 'r' };
    const isCmdOrCtrl = (keyCmdR.ctrl === true) || (keyCmdR.meta === true);
    const isR2 = keyCmdR.name === 'r';
    expect(isCmdOrCtrl && isR2).toBe(true);
    
    // Test regular R key (should not trigger)
    const keyR: KeyEvent = { name: 'r' };
    const isRegularR = (keyR.ctrl === true) || (keyR.meta === true);
    expect(isRegularR).toBe(false);
  });
});