
import { useState, useEffect, useRef } from 'react';
import { bridgeService } from '../services/bridgeService';

export const useBridge = (
  autoConnect: boolean,
  onMessageReceived: (content: string) => void
) => {
  const [isBridgeConnected, setIsBridgeConnected] = useState(false);
  const onMessageRef = useRef(onMessageReceived);

  // Keep ref fresh to avoid stale closures in the interval
  useEffect(() => {
    onMessageRef.current = onMessageReceived;
  }, [onMessageReceived]);

  useEffect(() => {
    let intervalId: any;

    const poll = async () => {
      // 1. Check for incoming tasks
      const msg = await bridgeService.fetchInput();
      
      if (msg) {
        setIsBridgeConnected(true);
        // Execute the callback (startSwarmCycle)
        if (onMessageRef.current) {
            onMessageRef.current(msg.content);
        }
      } 

      // 2. Health Check (Cheap Ping) if no message was processed
      // We do this to update the UI status indicator even if no messages are flowing
      try {
        // We re-use fetchInput's endpoint or a specific status endpoint if available.
        // Since fetchInput returns null on error, we can infer status somewhat, 
        // but let's do a lightweight check to keep the UI "Green" when idle.
        const res = await fetch('http://127.0.0.1:1234/bridge/app/input');
        if (res.ok) setIsBridgeConnected(true);
        else setIsBridgeConnected(false);
      } catch (e) {
        setIsBridgeConnected(false);
      }
    };

    if (autoConnect) {
      // Run immediately
      poll();
      // Then interval
      intervalId = setInterval(poll, 2000);
    } else {
      setIsBridgeConnected(false);
    }

    return () => clearInterval(intervalId);
  }, [autoConnect]);

  return { isBridgeConnected };
};
