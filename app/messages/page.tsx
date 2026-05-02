'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { Search, Send, User, MoreVertical, Phone, Video, Info, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';

type Chat = Database['public']['Tables']['chats']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];

export default function MessagesPage() {
  const [user, setUser] = useState<{ name: string; role: string; email: string } | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const userData = {
      name: localStorage.getItem('userName') || localStorage.getItem('userEmail')?.split('@')[0] || 'User',
      role: localStorage.getItem('role') || 'staff',
      email: localStorage.getItem('userEmail') || '',
    };
    setTimeout(() => {
      setUser(userData);
    }, 0);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchChats = useCallback(async () => {
    setIsLoadingChats(true);
    try {
      const tenantId = localStorage.getItem('tenant_id');
      const role = localStorage.getItem('role');

      let query = supabase
        .from('chats')
        .select('*');

      if (role !== 'super_admin' && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setChats(data);
        if (!activeChat) setActiveChat(data[0]);
      } else {
        // Seed initial chats if empty
        const initialChats = [
          { name: 'John Doe (Admin)', last_msg: 'The staff meeting has been rescheduled...', last_msg_time: '10:30 AM', unread_count: 2, is_online: true, tenant_id: tenantId },
          { name: 'Jane Smith (Staff)', last_msg: 'I have marked the attendance for Class B', last_msg_time: '9:15 AM', unread_count: 0, is_online: false, tenant_id: tenantId },
          { name: 'Robert Fox', last_msg: 'Can you check the fee status for Sarah?', last_msg_time: 'Yesterday', unread_count: 0, is_online: true, tenant_id: tenantId },
        ];
        const { data: seeded } = await supabase.from('chats').insert(initialChats).select();
        if (seeded) {
          setChats(seeded);
          setActiveChat(seeded[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setIsLoadingChats(false);
    }
  }, [activeChat]);

  const fetchMessages = useCallback(async (chatId: string) => {
    setIsLoadingMessages(true);
    try {
      const tenantId = localStorage.getItem('tenant_id');
      const role = localStorage.getItem('role');

      let query = supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId);

      if (role !== 'super_admin' && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query.order('created_at', { ascending: true });
      
      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();

    const chatsSub = supabase
      .channel('chats-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => {
        fetchChats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chatsSub);
    };
  }, [fetchChats]);

  useEffect(() => {
    if (activeChat) {
      fetchMessages(activeChat.id);

      const messagesSub = supabase
        .channel(`messages-${activeChat.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `chat_id=eq.${activeChat.id}`
        }, (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(messagesSub);
      };
    }
  }, [activeChat, fetchMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeChat || !user) return;

    const tenantId = localStorage.getItem('tenant_id');
    const role = localStorage.getItem('role');

    const newMessage = {
      chat_id: activeChat.id,
      sender_name: user.name || 'Me',
      text: messageText,
      is_me: true,
      tenant_id: tenantId
    };

    setMessageText('');

    try {
      const { error } = await supabase.from('messages').insert(newMessage);
      if (error) throw error;

      // Update chat's last message
      let updateQuery = supabase
        .from('chats')
        .update({ 
          last_msg: messageText, 
          last_msg_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        })
        .eq('id', activeChat.id);

      if (role !== 'super_admin' && tenantId) {
        updateQuery = updateQuery.eq('tenant_id', tenantId);
      }

      await updateQuery;

    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-160px)] flex gap-6">
        {/* Chat List */}
        <div className="w-80 glass-card flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h3 className="font-display font-bold text-xl mb-4">Messages</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input type="text" placeholder="Search chats..." className="input-field w-full pl-10 py-2 text-sm" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoadingChats ? (
              <div className="p-8 text-center text-text-muted">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-xs">Loading chats...</p>
              </div>
            ) : chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setActiveChat(chat)}
                className={`w-full p-4 flex gap-3 hover:bg-white/5 transition-colors border-l-4 ${activeChat?.id === chat.id ? 'bg-white/5 border-accent' : 'border-transparent'}`}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center font-bold text-accent">
                    {chat.name[0]}
                  </div>
                  {chat.is_online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-primary rounded-full" />}
                </div>
                <div className="flex-1 text-left overflow-hidden">
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-bold text-sm truncate">{chat.name}</p>
                    <span className="text-[10px] text-text-muted">{chat.last_msg_time}</span>
                  </div>
                  <p className="text-xs text-text-muted truncate">{chat.last_msg}</p>
                </div>
                {chat.unread_count > 0 && (
                  <div className="w-5 h-5 bg-accent rounded-full flex items-center justify-center text-[10px] font-bold">
                    {chat.unread_count}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 glass-card flex flex-col overflow-hidden">
          {activeChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center font-bold text-accent">
                    {activeChat.name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{activeChat.name}</p>
                    <p className={`text-[10px] font-medium ${activeChat.is_online ? 'text-emerald-500' : 'text-text-muted'}`}>
                      {activeChat.is_online ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-text-muted">
                    <Phone className="w-5 h-5" />
                  </button>
                  <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-text-muted">
                    <Video className="w-5 h-5" />
                  </button>
                  <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-text-muted">
                    <Info className="w-5 h-5" />
                  </button>
                  <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-text-muted">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-secondary/30">
                {isLoadingMessages ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-text-muted space-y-4">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                      <Send className="w-8 h-8 opacity-20" />
                    </div>
                    <p className="text-sm">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.is_me ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] space-y-1 ${msg.is_me ? 'items-end' : 'items-start'}`}>
                        <div className={`p-4 rounded-2xl text-sm ${msg.is_me ? 'bg-accent text-white rounded-tr-none' : 'bg-white/10 text-white rounded-tl-none'}`}>
                          {msg.text}
                        </div>
                        <p className="text-[10px] text-text-muted px-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-white/10 bg-white/5">
                <form 
                  onSubmit={handleSendMessage}
                  className="flex gap-3"
                >
                  <input 
                    type="text" 
                    placeholder="Type your message here..." 
                    className="input-field flex-1 py-3"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                  />
                  <button type="submit" className="btn-primary px-6">
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-text-muted space-y-4">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                <User className="w-10 h-10 opacity-20" />
              </div>
              <p className="text-sm">Select a chat to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
