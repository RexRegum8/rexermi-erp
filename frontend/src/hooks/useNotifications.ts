import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

export function useNotifications() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [lastNotification, setLastNotification] = useState<any>(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    // Handle generic events
    const events = [
        'system:user_created', 
        'system:role_created', 
        'auth:login',
        'system:update_available',
        'system:update_progress',
        'system:update_ready'
    ];
    
    events.forEach(event => {
      newSocket.on(event, (data) => {
        setLastNotification({ event, data, timestamp: new Date() });
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return { socket, lastNotification };
}
