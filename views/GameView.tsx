
import React, { useState, useEffect } from 'react';
import { db, auth } from '../services/firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, arrayUnion, getDoc, arrayRemove } from 'firebase/firestore';
import { GameRoom, Player } from '../types';
import { onAuthStateChanged, User } from 'firebase/auth';
import Icon from '../components/Icon';

const GameView: React.FC = () => {
    const [gameRooms, setGameRooms] = useState<GameRoom[]>([]);
    const [activeRoom, setActiveRoom] = useState<GameRoom | null>(null);
    const [newRoomName, setNewRoomName] = useState('');
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'gameRooms'), (snapshot) => {
            const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameRoom));
            setGameRooms(rooms);
        });
        return () => unsubscribe();
    }, []);

    const createRoom = async () => {
        if (!user || !newRoomName) return;
        const newRoom: Omit<GameRoom, 'id'> = {
            name: newRoomName,
            hostId: user.uid,
            players: [{ id: user.uid, name: user.displayName || 'Anonymous', avatarUrl: user.photoURL || '' }],
            createdAt: new Date()
        };
        const docRef = await addDoc(collection(db, 'gameRooms'), newRoom);
        setActiveRoom({ id: docRef.id, ...newRoom });
        setNewRoomName('');
    };

    const joinRoom = async (roomId: string) => {
        if (!user) return;
        const roomRef = doc(db, 'gameRooms', roomId);
        await updateDoc(roomRef, {
            players: arrayUnion({ id: user.uid, name: user.displayName || 'Anonymous', avatarUrl: user.photoURL || '' })
        });
        const roomSnap = await getDoc(roomRef);
        setActiveRoom({ id: roomSnap.id, ...roomSnap.data() } as GameRoom);
    };

    const leaveRoom = async (roomId: string) => {
        if (!user) return;
        const roomRef = doc(db, 'gameRooms', roomId);
        const roomSnap = await getDoc(roomRef);
        const room = roomSnap.data() as GameRoom;

        if (room.hostId === user.uid && room.players.length > 1) {
            // Assign a new host
            const newHost = room.players.find(p => p.id !== user.uid);
            if (newHost) {
                await updateDoc(roomRef, {
                    hostId: newHost.id
                });
            }
        } else if (room.players.length <= 1) {
            // Delete the room
            await updateDoc(roomRef, {
                players: arrayRemove({ id: user.uid, name: user.displayName || 'Anonymous', avatarUrl: user.photoURL || '' })
            });
        }

        await updateDoc(roomRef, {
            players: arrayRemove({ id: user.uid, name: user.displayName || 'Anonymous', avatarUrl: user.photoURL || '' })
        });


        setActiveRoom(null);
    };

    if (!user) {
        return <div className="p-4 text-center">Please log in to play.</div>;
    }

    if (activeRoom) {
        return (
            <div className="p-4">
                <h2 className="text-xl font-bold mb-4">{activeRoom.name}</h2>
                <div className="mb-4">
                    <h3 className="font-bold">Players:</h3>
                    <ul>
                        {activeRoom.players.map(player => (
                            <li key={player.id} className="flex items-center">
                                <img src={player.avatarUrl} alt={player.name} className="w-8 h-8 rounded-full mr-2" />
                                {player.name}
                            </li>
                        ))}
                    </ul>
                </div>
                <button onClick={() => leaveRoom(activeRoom.id)} className="bg-red-500 text-white px-4 py-2 rounded">Leave Room</button>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="mb-4">
                <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="New room name"
                    className="border p-2 rounded w-full"
                />
                <button onClick={createRoom} className="bg-blue-500 text-white px-4 py-2 rounded mt-2">Create Room</button>
            </div>
            <div>
                <h2 className="text-xl font-bold mb-2">Available Rooms</h2>
                {gameRooms.map(room => (
                    <div key={room.id} className="p-2 border-b flex justify-between items-center">
                        <span>{room.name}</span>
                        <button onClick={() => joinRoom(room.id)} className="bg-green-500 text-white px-4 py-2 rounded">Join</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GameView;
