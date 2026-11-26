import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  RefreshControl,
  KeyboardAvoidingView,
  Switch,
} from 'react-native';
import {
  MessageSquare,
  Search,
  Send,
  ArrowLeft,
  Users,
  Megaphone,
  User,
  CheckCheck,
  X,
  FileText,
  ChevronRight,
  Paperclip,
  Smile,
  AtSign,
  UserPlus,
  Share2,
} from 'lucide-react-native';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { AppHeader } from '../../components/common/AppHeader';
import { theme } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import {
  getConversations,
  getMessages,
  postChatMessage,
  startDirectChat,
  createChannel,
  markConversationRead,
  toggleReaction,
  getAvailableUsersForChat,
  ChatConversation,
  ChatMessage,
  ChatDirectoryUser,
} from '../../api/chatApi';
import { fetchDepartments, DepartmentItem } from '../../api/masterApi';

type FilterCategory = 'ALL' | 'DIRECT' | 'GROUP' | 'BROADCAST' | 'UNREAD';

interface SelectedAttachment {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

const EMOJI_TRAY = ['👍', '❤️', '🔥', '🎉', '👏', '🙌', '✅', '🚀', '💡'];

export const ChatScreen: React.FC = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super admin';

  // Conversations & Active Thread State
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('ALL');

  // Composer State
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SelectedAttachment | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  // Announcement Mode State
  const [isAnnouncementMode, setIsAnnouncementMode] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementExpiry, setAnnouncementExpiry] = useState('');

  // Modals
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
  const [isDirectModalOpen, setIsDirectModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);

  // Directory users & depts
  const [directoryUsers, setDirectoryUsers] = useState<ChatDirectoryUser[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Group Form State
  const [groupTitle, setGroupTitle] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupSelectedMembers, setGroupSelectedMembers] = useState<number[]>([]);
  const [groupIsAdminOnly, setGroupIsAdminOnly] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Broadcast Form State
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastDescription, setBroadcastDescription] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState('COMPANY_UPDATE');
  const [broadcastTargetDept, setBroadcastTargetDept] = useState<string>('');
  const [creatingBroadcast, setCreatingBroadcast] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Helper function to extract array from varying response shapes
  const extractList = <T,>(res: any, key: string): T[] => {
    if (!res) return [];
    if (Array.isArray(res[key])) return res[key];
    if (res.data && Array.isArray(res.data[key])) return res.data[key];
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res)) return res;
    return [];
  };

  // 1. Load Conversations
  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      const res = await getConversations();
      if (res.success) {
        const list = extractList<ChatConversation>(res, 'conversations');
        setConversations(list);
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoadingConversations(false);
      setRefreshing(false);
    }
  }, []);

  // 2. Load Directory Users & Departments
  const loadDirectory = useCallback(async () => {
    try {
      const [uRes, dRes] = await Promise.all([
        getAvailableUsersForChat().catch(() => null),
        fetchDepartments(false).catch(() => null),
      ]);
      if (uRes?.success) {
        const uList = extractList<ChatDirectoryUser>(uRes, 'users');
        setDirectoryUsers(uList);
      }
      if (dRes?.success && Array.isArray(dRes.data)) {
        setDepartments(dRes.data);
      }
    } catch (err) {
      console.error('Error loading chat directory:', err);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    loadDirectory();
  }, [loadConversations, loadDirectory]);

  // 3. Load Messages when active conversation changes
  const loadMessages = useCallback(async (convId: number) => {
    try {
      setLoadingMessages(true);
      const res = await getMessages(convId, 100);
      if (res.success) {
        const msgList = extractList<ChatMessage>(res, 'messages');
        setMessages(msgList);
      }
      // Mark as read
      await markConversationRead(convId).catch(() => {});
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
      );
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (selectedConvId) {
      loadMessages(selectedConvId);
    }
  }, [selectedConvId, loadMessages]);

  const onRefresh = () => {
    setRefreshing(true);
    if (selectedConvId) {
      loadMessages(selectedConvId);
    } else {
      loadConversations();
    }
  };

  // Active conversation details
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedConvId) || null;
  }, [conversations, selectedConvId]);

  // Meta info for conversation item
  const getConvMeta = (conv: ChatConversation) => {
    const type = (conv.type || '').toUpperCase().trim();
    if (type === 'DIRECT') {
      return {
        name: conv.other_user_name || 'Direct Message',
        subtitle: conv.other_user_department || conv.other_user_role || 'Colleague',
        initial: (conv.other_user_name || 'U')[0].toUpperCase(),
        badgeBg: '#EFF6FF',
        badgeText: '#2563EB',
        icon: User,
      };
    }
    if (type === 'BROADCAST') {
      return {
        name: conv.title || 'Broadcast Channel',
        subtitle: conv.target_department_name
          ? `${conv.target_department_name} Announcement`
          : 'Company Announcement',
        initial: '📢',
        badgeBg: '#FEF3C7',
        badgeText: '#D97706',
        icon: Megaphone,
      };
    }
    return {
      name: conv.title || 'Group Channel',
      subtitle: `${conv.member_count || 1} members`,
      initial: '#',
      badgeBg: '#F3E8FF',
      badgeText: '#7C3AED',
      icon: Users,
    };
  };

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const meta = getConvMeta(c);
      const matchesSearch =
        meta.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.last_message_text && c.last_message_text.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const type = (c.type || '').toUpperCase().trim();
      if (filterCategory === 'DIRECT') return type === 'DIRECT';
      if (filterCategory === 'GROUP') return type === 'GROUP' || type === 'CHANNEL';
      if (filterCategory === 'BROADCAST') return type === 'BROADCAST';
      if (filterCategory === 'UNREAD') return (c.unread_count || 0) > 0;
      return true;
    });
  }, [conversations, searchQuery, filterCategory]);

  // Total unread count
  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (Number(c.unread_count) || 0), 0);
  }, [conversations]);

  // Mention candidates
  const mentionCandidates = useMemo(() => {
    if (!mentionQuery) return directoryUsers.slice(0, 6);
    const q = mentionQuery.toLowerCase();
    return directoryUsers
      .filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.username && u.username.toLowerCase().includes(q)) ||
          (u.department_name && u.department_name.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [directoryUsers, mentionQuery]);

  // Handle Pick Attachment Document
  const handlePickAttachment = async () => {
    try {
      const [res] = await pick({
        mode: 'open',
        type: [types.allFiles],
      });
      if (res && res.uri) {
        setSelectedFile({
          uri: res.uri,
          name: res.name || 'attachment',
          type: res.type || 'application/octet-stream',
          size: res.size ?? undefined,
        });
      }
    } catch (err: unknown) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      Alert.alert('Notice', 'Could not select document');
    }
  };

  // Handle Send Message
  const handleSendMessage = async () => {
    const text = messageText.trim();
    if ((!text && !selectedFile) || !selectedConvId) return;

    if (isAnnouncementMode && !announcementTitle.trim()) {
      Alert.alert('Required', 'Please enter an announcement headline/title.');
      return;
    }

    try {
      setSending(true);
      const res = await postChatMessage(selectedConvId, {
        messageText: text,
        isAnnouncement: isAnnouncementMode || activeConversation?.type === 'BROADCAST',
        announcementTitle: isAnnouncementMode ? announcementTitle.trim() : null,
        announcementExpiry: isAnnouncementMode ? announcementExpiry : null,
        file: selectedFile,
      });

      if (res.success) {
        const returnedMsg: ChatMessage =
          (res as any).message ||
          (res.data as any)?.message || {
            id: Date.now(),
            conversation_id: selectedConvId,
            sender_id: user?.id || 0,
            sender_name: user?.name || user?.username || 'Me',
            message_text: text,
            created_at: new Date().toISOString(),
            file_name: selectedFile?.name,
          };

        setMessages((prev) => [...prev, returnedMsg]);
        setMessageText('');
        setSelectedFile(null);
        setIsAnnouncementMode(false);
        setAnnouncementTitle('');
        setAnnouncementExpiry('');
        setShowEmojiPicker(false);
        setShowMentionDropdown(false);

        // Update last message preview in conversations list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConvId
              ? {
                  ...c,
                  last_message_text: text || selectedFile?.name || 'Attachment',
                  last_message_time: new Date().toISOString(),
                  last_message_sender_name: user?.name || user?.username || 'You',
                }
              : c
          )
        );

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 120);
      } else {
        Alert.alert('Notice', res.message || 'Failed to send message');
      }
    } catch {
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  // Start 1-on-1 Chat
  const handleStartDirect = async (targetUser: ChatDirectoryUser) => {
    try {
      setIsDirectModalOpen(false);
      const res = await startDirectChat(targetUser.id);
      if (res.success) {
        const convId = (res as any).conversationId || (res.data as any)?.conversationId;
        await loadConversations();
        if (convId) {
          setSelectedConvId(convId);
        }
      } else {
        Alert.alert('Notice', res.message || 'Could not start chat');
      }
    } catch {
      Alert.alert('Error', 'Could not start conversation with user.');
    }
  };

  // Create Channel / Group
  const handleCreateGroup = async () => {
    if (!groupTitle.trim()) {
      Alert.alert('Validation Error', 'Channel Name is required.');
      return;
    }
    try {
      setCreatingGroup(true);
      const res = await createChannel({
        title: groupTitle.trim(),
        description: groupDescription.trim(),
        type: 'GROUP',
        memberIds: groupSelectedMembers,
        isAdminOnly: groupIsAdminOnly,
      });

      if (res.success) {
        const convId = (res as any).conversationId || (res.data as any)?.channel?.id;
        setIsGroupModalOpen(false);
        setGroupTitle('');
        setGroupDescription('');
        setGroupSelectedMembers([]);
        await loadConversations();
        if (convId) setSelectedConvId(convId);
      } else {
        Alert.alert('Notice', res.message || 'Group created.');
        setIsGroupModalOpen(false);
        await loadConversations();
      }
    } catch {
      Alert.alert('Error', 'Failed to create channel.');
    } finally {
      setCreatingGroup(false);
    }
  };

  // Create Broadcast Channel
  const handleCreateBroadcast = async () => {
    if (!broadcastTitle.trim()) {
      Alert.alert('Validation Error', 'Broadcast title is required.');
      return;
    }
    try {
      setCreatingBroadcast(true);
      const res = await createChannel({
        title: broadcastTitle.trim(),
        description: broadcastDescription.trim(),
        type: 'BROADCAST',
        broadcastPriority,
        targetDepartmentId: broadcastTargetDept || null,
      });

      if (res.success) {
        const convId = (res as any).conversationId || (res.data as any)?.channel?.id;
        setIsBroadcastModalOpen(false);
        setBroadcastTitle('');
        setBroadcastDescription('');
        await loadConversations();
        if (convId) setSelectedConvId(convId);
      } else {
        Alert.alert('Notice', res.message || 'Broadcast channel created.');
        setIsBroadcastModalOpen(false);
        await loadConversations();
      }
    } catch {
      Alert.alert('Error', 'Failed to create broadcast.');
    } finally {
      setCreatingBroadcast(false);
    }
  };

  // Toggle emoji reaction
  const handleReaction = async (msgId: number, emoji: string) => {
    if (!selectedConvId) return;
    try {
      const res = await toggleReaction(msgId, emoji, selectedConvId);
      if (res.success) {
        const newReactions = (res as any).reactions || (res.data as any)?.reactions;
        if (newReactions) {
          setMessages((prev) =>
            prev.map((m) => (m.id === msgId ? { ...m, reactions: newReactions } : m))
          );
        }
      }
    } catch {
      // quiet
    }
  };

  // Format time
  const formatTime = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Handle Mention Select
  const handleSelectMention = (colleague: ChatDirectoryUser) => {
    const mentionTag = `@${colleague.name} `;
    setMessageText((prev) => {
      const lastAt = prev.lastIndexOf('@');
      if (lastAt !== -1) {
        return prev.slice(0, lastAt) + mentionTag;
      }
      return prev + mentionTag;
    });
    setShowMentionDropdown(false);
  };

  // Filtered directory users
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return directoryUsers;
    const q = userSearchQuery.toLowerCase().trim();
    return directoryUsers.filter(
      (u) =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.department_name && u.department_name.toLowerCase().includes(q))
    );
  }, [directoryUsers, userSearchQuery]);

  return (
    <ScreenWrapper dark={false} edges={['right', 'bottom', 'left']} statusBarStyle="light-content">
      {/* ────────────────────────────────────────────────────────
          VIEW 1: ACTIVE THREAD VIEW (MESSAGES & COMPOSER)
      ──────────────────────────────────────────────────────── */}
      {selectedConvId && activeConversation ? (
        <KeyboardAvoidingView
          style={styles.threadContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
          {/* Thread Header */}
          <View style={styles.threadHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setSelectedConvId(null)}
              activeOpacity={0.7}
            >
              <ArrowLeft size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.threadAvatarCircle}>
              <Text style={styles.threadAvatarText}>
                {getConvMeta(activeConversation).initial}
              </Text>
            </View>

            <View style={styles.threadHeaderInfo}>
              <Text style={styles.threadHeaderName} numberOfLines={1}>
                {getConvMeta(activeConversation).name}
              </Text>
              <Text style={styles.threadHeaderSubtitle} numberOfLines={1}>
                {getConvMeta(activeConversation).subtitle}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.threadInfoBtn}
              onPress={() => {
                Alert.alert(
                  getConvMeta(activeConversation).name,
                  `Type: ${activeConversation.type}\n${activeConversation.description || 'Active workspace conversation thread'}`
                );
              }}
            >
              <Share2 size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Messages FlatList */}
          {loadingMessages ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="small" color="#17365D" />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.messagesListContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => {
                const isMe = item.sender_id === user?.id;
                const isBroadcast = item.is_announcement || activeConversation.type === 'BROADCAST';

                return (
                  <View
                    style={[
                      styles.messageRow,
                      isMe ? styles.messageRowMe : styles.messageRowOther,
                    ]}
                  >
                    {!isMe && (
                      <View style={styles.msgAvatarBox}>
                        <Text style={styles.msgAvatarInitial}>
                          {(item.sender_name || 'U')[0].toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View
                      style={[
                        styles.messageBubble,
                        isMe ? styles.bubbleMe : styles.bubbleOther,
                        isBroadcast && styles.bubbleBroadcast,
                      ]}
                    >
                      {/* Broadcast banner badge */}
                      {isBroadcast && (
                        <View style={styles.broadcastBanner}>
                          <Megaphone size={12} color="#D97706" />
                          <Text style={styles.broadcastBannerText}>OFFICIAL ANNOUNCEMENT</Text>
                        </View>
                      )}

                      {!isMe && (
                        <Text style={styles.senderName}>{item.sender_name || 'Colleague'}</Text>
                      )}

                      {/* File Attachment Pill */}
                      {Boolean(item.file_name) && (
                        <View style={styles.fileAttachmentRow}>
                          <FileText size={15} color={isMe ? '#FFFFFF' : '#2563EB'} />
                          <Text
                            style={[
                              styles.fileNameText,
                              isMe ? styles.fileNameTextMe : styles.fileNameTextOther,
                            ]}
                            numberOfLines={1}
                          >
                            {item.file_name}
                          </Text>
                        </View>
                      )}

                      {item.message_text ? (
                        <Text
                          style={[
                            styles.messageText,
                            isMe ? styles.messageTextMe : styles.messageTextOther,
                          ]}
                        >
                          {item.message_text}
                        </Text>
                      ) : null}

                      {/* Message Footer: Timestamp & Read checkmark */}
                      <View style={styles.msgFooterRow}>
                        <Text
                          style={[
                            styles.msgTimeText,
                            isMe ? styles.msgTimeTextMe : styles.msgTimeTextOther,
                          ]}
                        >
                          {formatTime(item.created_at)}
                        </Text>
                        {isMe && (
                          <CheckCheck size={13} color="#93C5FD" style={styles.msgCheckIcon} />
                        )}
                      </View>

                      {/* Reactions Pill Row */}
                      {item.reactions && item.reactions.length > 0 && (
                        <View style={styles.reactionsRow}>
                          {item.reactions.map((r: any, rIdx: number) => (
                            <TouchableOpacity
                              key={rIdx}
                              style={styles.reactionPill}
                              onPress={() => handleReaction(item.id, r.emoji)}
                            >
                              <Text style={styles.reactionEmojiText}>{r.emoji}</Text>
                              <Text style={styles.reactionCountText}>{r.count || r.users?.length || 1}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyMessagesBox}>
                  <MessageSquare size={32} color="#CBD5E1" />
                  <Text style={styles.emptyMessagesTitle}>Start the discussion</Text>
                  <Text style={styles.emptyMessagesSubtitle}>
                    Send a message to kick off this communication thread.
                  </Text>
                </View>
              }
            />
          )}

          {/* Quick Reaction Bar */}
          <View style={styles.quickReactionBar}>
            {['👍', '❤️', '🎉', '🔥', '👏'].map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.quickReactionBtn}
                onPress={() => {
                  if (messages.length > 0) {
                    const lastMsg = messages[messages.length - 1];
                    handleReaction(lastMsg.id, emoji);
                  }
                }}
              >
                <Text style={styles.quickReactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Announcement Mode Form Fields (Title & Expiry Date) */}
          {isAnnouncementMode && (
            <View style={styles.announcementComposerBox}>
              <View style={styles.announcementHeaderRow}>
                <View style={styles.announcementTag}>
                  <Megaphone size={12} color="#B45309" />
                  <Text style={styles.announcementTagText}>Official Announcement Composer</Text>
                </View>
                <TouchableOpacity onPress={() => setIsAnnouncementMode(false)}>
                  <X size={15} color="#92400E" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.announcementInput}
                placeholder="Announcement Headline / Title (required)..."
                placeholderTextColor="#A1A1AA"
                value={announcementTitle}
                onChangeText={setAnnouncementTitle}
              />

              <TextInput
                style={styles.announcementInput}
                placeholder="Expiry Date (optional: YYYY-MM-DD)..."
                placeholderTextColor="#A1A1AA"
                value={announcementExpiry}
                onChangeText={setAnnouncementExpiry}
              />
            </View>
          )}

          {/* Attached File Preview Pill */}
          {selectedFile && (
            <View style={styles.selectedFilePill}>
              <Paperclip size={13} color="#2563EB" />
              <Text style={styles.selectedFileName} numberOfLines={1}>
                {selectedFile.name}
              </Text>
              <TouchableOpacity onPress={() => setSelectedFile(null)}>
                <X size={14} color="#64748B" />
              </TouchableOpacity>
            </View>
          )}

          {/* Mention Candidates Dropdown Popover */}
          {showMentionDropdown && mentionCandidates.length > 0 && (
            <View style={styles.mentionDropdown}>
              <Text style={styles.mentionHeaderTitle}>Tag Colleague (@)</Text>
              {mentionCandidates.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.mentionItemRow}
                  onPress={() => handleSelectMention(c)}
                >
                  <View style={styles.mentionAvatar}>
                    <Text style={styles.mentionAvatarText}>
                      {(c.name || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.mentionCol}>
                    <Text style={styles.mentionName}>{c.name}</Text>
                    <Text style={styles.mentionSub}>
                      {c.department_name || c.role || 'Member'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Emoji Tray Popover */}
          {showEmojiPicker && (
            <View style={styles.emojiTray}>
              {EMOJI_TRAY.map((em) => (
                <TouchableOpacity
                  key={em}
                  style={styles.emojiTrayItem}
                  onPress={() => {
                    setMessageText((prev) => prev + em);
                    setShowEmojiPicker(false);
                  }}
                >
                  <Text style={styles.emojiTrayText}>{em}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Message Composer Toolbar & Text Input Field */}
          <View style={styles.composerContainer}>
            <View style={styles.composerBar}>
              {/* Paperclip Document Picker */}
              <TouchableOpacity
                style={styles.composerActionBtn}
                onPress={handlePickAttachment}
                accessibilityLabel="Attach Document or Image"
              >
                <Paperclip size={18} color="#64748B" />
              </TouchableOpacity>

              {/* Announcement Mode Toggle (Admin only or Broadcast channel) */}
              {(isAdmin || activeConversation?.type === 'BROADCAST') && (
                <TouchableOpacity
                  style={[
                    styles.composerActionBtn,
                    isAnnouncementMode && styles.composerActionBtnActive,
                  ]}
                  onPress={() => setIsAnnouncementMode(!isAnnouncementMode)}
                  accessibilityLabel="Official Announcement Mode"
                >
                  <Megaphone
                    size={18}
                    color={isAnnouncementMode ? '#D97706' : '#64748B'}
                  />
                </TouchableOpacity>
              )}

              {/* @Mention Tag Button */}
              <TouchableOpacity
                style={styles.composerActionBtn}
                onPress={() => {
                  setMessageText((prev) => (prev.endsWith(' ') || !prev ? prev + '@' : prev + ' @'));
                  setShowMentionDropdown(true);
                  setMentionQuery('');
                }}
                accessibilityLabel="Tag Colleague"
              >
                <AtSign size={18} color="#64748B" />
              </TouchableOpacity>

              {/* Emoji Picker Button */}
              <TouchableOpacity
                style={styles.composerActionBtn}
                onPress={() => setShowEmojiPicker(!showEmojiPicker)}
                accessibilityLabel="Insert Emoji"
              >
                <Smile size={18} color="#64748B" />
              </TouchableOpacity>

              {/* Main Chat Text Input Field */}
              <TextInput
                style={styles.composerInput}
                placeholder={`Message ${getConvMeta(activeConversation).name}...`}
                placeholderTextColor="#94A3B8"
                value={messageText}
                onChangeText={(val) => {
                  setMessageText(val);
                  // Check if user is typing an @mention
                  const lastAt = val.lastIndexOf('@');
                  if (lastAt !== -1 && lastAt >= val.length - 15) {
                    setShowMentionDropdown(true);
                    setMentionQuery(val.slice(lastAt + 1));
                  } else {
                    setShowMentionDropdown(false);
                  }
                }}
                multiline
              />

              {/* Send Button */}
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (!messageText.trim() && !selectedFile) && styles.sendBtnDisabled,
                ]}
                onPress={handleSendMessage}
                disabled={sending || (!messageText.trim() && !selectedFile)}
                activeOpacity={0.8}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Send size={16} color="#FFFFFF" strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : (
        /* ────────────────────────────────────────────────────────
            VIEW 2: CONVERSATIONS ROSTER LIST VIEW
        ──────────────────────────────────────────────────────── */
        <>
          {/* Curved App Header */}
          <AppHeader
            title="Chat"
            showBack={false}
            backgroundColor={theme.colors.primary}
            curveRadius={65}
          />

          {/* Search Box */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInner}>
              <Search size={16} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search chats, colleagues, or messages..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={15} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Filter Categories Horizontal Bar */}
          <View style={styles.filterBar}>
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'DIRECT', label: 'Direct' },
                { id: 'GROUP', label: 'Groups' },
                { id: 'BROADCAST', label: 'Broadcasts' },
                { id: 'UNREAD', label: 'Unread', count: totalUnreadCount },
              ] as const
            ).map((tab) => {
              const isActive = filterCategory === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => setFilterCategory(tab.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      isActive && styles.filterPillTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {Boolean((tab as any).count && (tab as any).count > 0) && (
                    <View style={styles.filterPillBadge}>
                      <Text style={styles.filterPillBadgeText}>{(tab as any).count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Conversations List */}
          {loadingConversations && !refreshing ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color="#17365D" />
              <Text style={styles.loadingText}>Loading conversations...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredConversations}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.convListContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={['#17365D']}
                  tintColor="#17365D"
                />
              }
              renderItem={({ item }) => {
                const meta = getConvMeta(item);
                const hasUnread = (Number(item.unread_count) || 0) > 0;

                return (
                  <TouchableOpacity
                    style={[styles.convItemCard, hasUnread && styles.convItemUnread]}
                    onPress={() => setSelectedConvId(item.id)}
                    activeOpacity={0.7}
                  >
                    {/* Avatar */}
                    <View style={styles.convAvatarCircle}>
                      <Text style={styles.convAvatarText}>{meta.initial}</Text>
                    </View>

                    {/* Middle Info */}
                    <View style={styles.convMiddleCol}>
                      <View style={styles.convTitleRow}>
                        <Text style={styles.convName} numberOfLines={1}>
                          {meta.name}
                        </Text>
                        <Text style={styles.convTimeText}>
                          {formatTime(item.last_message_time || item.updated_at)}
                        </Text>
                      </View>

                      <View style={styles.convSnippetRow}>
                        <Text
                          style={[
                            styles.convSnippetText,
                            hasUnread && styles.convSnippetUnread,
                          ]}
                          numberOfLines={1}
                        >
                          {item.last_message_sender_name
                            ? `${item.last_message_sender_name}: `
                            : ''}
                          {item.last_message_text || 'No messages yet'}
                        </Text>

                        {hasUnread && (
                          <View style={styles.unreadCounterBadge}>
                            <Text style={styles.unreadCounterText}>
                              {item.unread_count}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyConvBox}>
                  <MessageSquare size={36} color="#94A3B8" />
                  <Text style={styles.emptyConvTitle}>
                    {filterCategory === 'GROUP'
                      ? 'No group channels found'
                      : filterCategory === 'DIRECT'
                      ? 'No direct chats found'
                      : filterCategory === 'BROADCAST'
                      ? 'No announcement channels found'
                      : 'No conversations found'}
                  </Text>
                  <Text style={styles.emptyConvSubtitle}>
                    {filterCategory === 'GROUP'
                      ? 'Create a group channel to collaborate with multiple team members.'
                      : filterCategory === 'DIRECT'
                      ? 'Start a private 1-on-1 direct chat with any colleague.'
                      : filterCategory === 'BROADCAST'
                      ? 'No official broadcast channels found.'
                      : 'Tap "+" at the top right to start messaging or create a channel.'}
                  </Text>
                  {filterCategory === 'GROUP' ? (
                    <TouchableOpacity
                      style={styles.emptyStartBtn}
                      onPress={() => {
                        loadDirectory();
                        setIsGroupModalOpen(true);
                      }}
                    >
                      <Users size={14} color="#FFFFFF" />
                      <Text style={styles.emptyStartBtnText}>Create Group Channel</Text>
                    </TouchableOpacity>
                  ) : filterCategory === 'BROADCAST' ? (
                    <TouchableOpacity
                      style={styles.emptyStartBtn}
                      onPress={() => {
                        loadDirectory();
                        setIsBroadcastModalOpen(true);
                      }}
                    >
                      <Megaphone size={14} color="#FFFFFF" />
                      <Text style={styles.emptyStartBtnText}>New Announcement Channel</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.emptyStartBtn}
                      onPress={() => {
                        loadDirectory();
                        setIsDirectModalOpen(true);
                      }}
                    >
                      <UserPlus size={14} color="#FFFFFF" />
                      <Text style={styles.emptyStartBtnText}>Start Direct Chat</Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
            />
          )}
        </>
      )}

      {/* ────────────────────────────────────────────────────────
          ACTION MENU MODAL (NEW CHAT / GROUP / BROADCAST)
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={isNewMenuOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsNewMenuOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsNewMenuOpen(false)}
        >
          <View style={styles.actionSheet}>
            <Text style={styles.actionSheetTitle}>Start New Communication</Text>

            {/* Direct Message Option */}
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setIsNewMenuOpen(false);
                loadDirectory();
                setIsDirectModalOpen(true);
              }}
            >
              <View style={[styles.actionIconWrap, styles.actionIconBlue]}>
                <User size={18} color="#2563EB" />
              </View>
              <View style={styles.actionItemTextCol}>
                <Text style={styles.actionItemTitle}>New Direct Chat</Text>
                <Text style={styles.actionItemDesc}>1-on-1 private messaging with a colleague</Text>
              </View>
            </TouchableOpacity>

            {/* Channel / Group Option */}
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setIsNewMenuOpen(false);
                loadDirectory();
                setIsGroupModalOpen(true);
              }}
            >
              <View style={[styles.actionIconWrap, styles.actionIconPurple]}>
                <Users size={18} color="#7C3AED" />
              </View>
              <View style={styles.actionItemTextCol}>
                <Text style={styles.actionItemTitle}>New Channel / Group</Text>
                <Text style={styles.actionItemDesc}>Team collaboration with multiple members</Text>
              </View>
            </TouchableOpacity>

            {/* Broadcast Option */}
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setIsNewMenuOpen(false);
                loadDirectory();
                setIsBroadcastModalOpen(true);
              }}
            >
              <View style={[styles.actionIconWrap, styles.actionIconAmber]}>
                <Megaphone size={18} color="#D97706" />
              </View>
              <View style={styles.actionItemTextCol}>
                <Text style={styles.actionItemTitle}>New Announcement Channel</Text>
                <Text style={styles.actionItemDesc}>Official announcements to department or company</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ────────────────────────────────────────────────────────
          MODAL: NEW DIRECT CHAT (DIRECTORY)
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={isDirectModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsDirectModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Start Direct Chat</Text>
              <TouchableOpacity onPress={() => setIsDirectModalOpen(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Search Directory Users */}
            <View style={styles.modalSearchBox}>
              <Search size={15} color="#94A3B8" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search colleagues..."
                placeholderTextColor="#94A3B8"
                value={userSearchQuery}
                onChangeText={setUserSearchQuery}
              />
            </View>

            <FlatList
              data={filteredUsers.filter((u) => u.id !== user?.id)}
              keyExtractor={(item) => String(item.id)}
              style={styles.modalListHeight380}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.userDirectoryRow}
                  onPress={() => handleStartDirect(item)}
                >
                  <View style={styles.userDirAvatar}>
                    <Text style={styles.userDirAvatarText}>
                      {(item.name || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userDirInfo}>
                    <Text style={styles.userDirName}>{item.name}</Text>
                    <Text style={styles.userDirSub}>
                      {item.department_name || item.role || 'Member'}
                    </Text>
                  </View>
                  <ChevronRight size={14} color="#94A3B8" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No colleagues found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* ────────────────────────────────────────────────────────
          MODAL: NEW GROUP / CHANNEL
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={isGroupModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsGroupModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Create New Channel</Text>
              <TouchableOpacity onPress={() => setIsGroupModalOpen(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollHeight420} showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>Channel Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Project Architecture Sync"
                placeholderTextColor="#94A3B8"
                value={groupTitle}
                onChangeText={setGroupTitle}
              />

              <Text style={styles.formLabelSpaced}>Description</Text>
              <TextInput
                style={styles.formInputMultiline}
                placeholder="Brief purpose of this team channel..."
                placeholderTextColor="#94A3B8"
                value={groupDescription}
                onChangeText={setGroupDescription}
                multiline
                numberOfLines={2}
              />

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Admins Only Can Post</Text>
                <Switch
                  value={groupIsAdminOnly}
                  onValueChange={setGroupIsAdminOnly}
                  trackColor={{ false: '#CBD5E1', true: '#2878C7' }}
                />
              </View>

              <Text style={styles.formLabelSpaced}>
                Select Members ({groupSelectedMembers.length} selected)
              </Text>
              <View style={styles.memberSelectionContainer}>
                {directoryUsers
                  .filter((u) => u.id !== user?.id)
                  .map((u) => {
                    const isSelected = groupSelectedMembers.includes(u.id);
                    return (
                      <TouchableOpacity
                        key={u.id}
                        style={[
                          styles.memberCheckRow,
                          isSelected && styles.memberCheckRowSelected,
                        ]}
                        onPress={() => {
                          setGroupSelectedMembers((prev) =>
                            isSelected ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                          );
                        }}
                      >
                        <View
                          style={[
                            styles.checkboxBox,
                            isSelected && styles.checkboxBoxActive,
                          ]}
                        >
                          {isSelected && <Text style={styles.whiteCheckMark}>✓</Text>}
                        </View>
                        <View style={styles.memberCheckInfo}>
                          <Text style={styles.memberCheckName}>{u.name}</Text>
                          <Text style={styles.memberCheckDept}>
                            {u.department_name || u.role || 'Member'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </View>

              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  creatingGroup && styles.btnDisabled,
                ]}
                onPress={handleCreateGroup}
                disabled={creatingGroup}
              >
                {creatingGroup ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Create Channel</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ────────────────────────────────────────────────────────
          MODAL: NEW BROADCAST CHANNEL
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={isBroadcastModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsBroadcastModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>New Broadcast Channel</Text>
              <TouchableOpacity onPress={() => setIsBroadcastModalOpen(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollHeight400} showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>Broadcast Title *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Executive & HR Announcements"
                placeholderTextColor="#94A3B8"
                value={broadcastTitle}
                onChangeText={setBroadcastTitle}
              />

              <Text style={styles.formLabelSpaced}>Description</Text>
              <TextInput
                style={styles.formInputMultiline}
                placeholder="Purpose of announcements..."
                placeholderTextColor="#94A3B8"
                value={broadcastDescription}
                onChangeText={setBroadcastDescription}
                multiline
                numberOfLines={2}
              />

              <Text style={styles.formLabelSpaced}>Broadcast Scope</Text>
              <View style={styles.priorityPillRow}>
                {[
                  { id: 'COMPANY_UPDATE', label: 'Company Wide' },
                  { id: 'URGENT_NOTICE', label: 'Urgent Notice' },
                  { id: 'POLICY_ALERT', label: 'Policy Alert' },
                ].map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.priorityPill,
                      broadcastPriority === p.id && styles.priorityPillActive,
                    ]}
                    onPress={() => setBroadcastPriority(p.id)}
                  >
                    <Text
                      style={[
                        styles.priorityPillText,
                        broadcastPriority === p.id && styles.priorityPillTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabelSpaced}>Target Department</Text>
              <View style={styles.deptPillsWrap}>
                <TouchableOpacity
                  style={[
                    styles.deptPill,
                    broadcastTargetDept === '' && styles.deptPillActive,
                  ]}
                  onPress={() => setBroadcastTargetDept('')}
                >
                  <Text
                    style={[
                      styles.deptPillText,
                      broadcastTargetDept === '' && styles.deptPillTextActive,
                    ]}
                  >
                    All Company
                  </Text>
                </TouchableOpacity>
                {departments.map((dept) => (
                  <TouchableOpacity
                    key={dept.id}
                    style={[
                      styles.deptPill,
                      broadcastTargetDept === String(dept.id) && styles.deptPillActive,
                    ]}
                    onPress={() => setBroadcastTargetDept(String(dept.id))}
                  >
                    <Text
                      style={[
                        styles.deptPillText,
                        broadcastTargetDept === String(dept.id) && styles.deptPillTextActive,
                      ]}
                    >
                      {dept.department_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  creatingBroadcast && styles.btnDisabled,
                ]}
                onPress={handleCreateBroadcast}
                disabled={creatingBroadcast}
              >
                {creatingBroadcast ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Launch Broadcast Channel</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  threadContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#17365D',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 14,
  },
  backButton: {
    padding: 6,
    marginRight: 6,
  },
  threadAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  threadAvatarText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  threadHeaderInfo: {
    flex: 1,
  },
  threadHeaderName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  threadHeaderSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 1,
  },
  threadInfoBtn: {
    padding: 6,
  },
  messagesListContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  msgAvatarBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  msgAvatarInitial: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  bubbleMe: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bubbleBroadcast: {
    borderColor: '#FDE68A',
    borderWidth: 1.5,
  },
  broadcastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  broadcastBannerText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#D97706',
  },
  senderName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2563EB',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  messageTextMe: {
    color: '#FFFFFF',
  },
  messageTextOther: {
    color: '#0F172A',
  },
  fileAttachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 4,
  },
  fileNameText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fileNameTextMe: {
    color: '#FFFFFF',
  },
  fileNameTextOther: {
    color: '#2563EB',
  },
  msgFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  msgTimeText: {
    fontSize: 9,
  },
  msgTimeTextMe: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  msgTimeTextOther: {
    color: '#94A3B8',
  },
  msgCheckIcon: {
    marginLeft: 3,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 2,
  },
  reactionEmojiText: {
    fontSize: 11,
  },
  reactionCountText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#475569',
  },
  quickReactionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  quickReactionBtn: {
    padding: 4,
  },
  quickReactionEmoji: {
    fontSize: 16,
  },
  announcementComposerBox: {
    backgroundColor: '#FFFBEB',
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  announcementHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  announcementTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  announcementTagText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#B45309',
  },
  announcementInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0F172A',
  },
  selectedFilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginHorizontal: 12,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  selectedFileName: {
    flex: 1,
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
  },
  mentionDropdown: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 8,
    maxHeight: 160,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  mentionHeaderTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  mentionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  mentionAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentionAvatarText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  mentionCol: {
    flex: 1,
  },
  mentionName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  mentionSub: {
    fontSize: 10,
    color: '#64748B',
  },
  emojiTray: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    marginHorizontal: 12,
    marginBottom: 6,
    paddingVertical: 8,
  },
  emojiTrayItem: {
    padding: 4,
  },
  emojiTrayText: {
    fontSize: 20,
  },
  composerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 6,
  },
  composerActionBtn: {
    padding: 6,
  },
  composerActionBtnActive: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  composerInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  emptyMessagesBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyMessagesTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 8,
  },
  emptyMessagesSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  /* Conversations Roster Styles */
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: -16,
    marginBottom: 8,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    padding: 0,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 10,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  filterPillActive: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  filterPillBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  filterPillBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  convListContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  convItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  convItemUnread: {
    borderColor: '#BFDBFE',
    backgroundColor: '#F8FAFC',
  },
  convAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  convAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  convMiddleCol: {
    flex: 1,
  },
  convTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  convName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    flex: 1,
    marginRight: 6,
  },
  convTimeText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  convSnippetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convSnippetText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
    marginRight: 8,
  },
  convSnippetUnread: {
    color: '#0F172A',
    fontWeight: '600',
  },
  unreadCounterBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadCounterText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  emptyConvBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 20,
  },
  emptyConvTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 8,
  },
  emptyConvSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  emptyStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
    gap: 6,
  },
  emptyStartBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 12,
  },
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconBlue: { backgroundColor: '#EFF6FF' },
  actionIconPurple: { backgroundColor: '#F3E8FF' },
  actionIconAmber: { backgroundColor: '#FEF3C7' },
  actionItemTextCol: { flex: 1 },
  actionItemTitle: { fontSize: 13, fontWeight: 'bold', color: '#0F172A' },
  actionItemDesc: { fontSize: 11, color: '#64748B', marginTop: 1 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginVertical: 10,
    gap: 6,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    padding: 0,
  },
  modalListHeight380: {
    maxHeight: 380,
  },
  modalScrollHeight420: {
    maxHeight: 420,
  },
  modalScrollHeight400: {
    maxHeight: 400,
  },
  userDirectoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  userDirAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDirAvatarText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userDirInfo: { flex: 1 },
  userDirName: { fontSize: 13, fontWeight: 'bold', color: '#0F172A' },
  userDirSub: { fontSize: 11, color: '#64748B', marginTop: 1 },

  formLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 4,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  formLabelSpaced: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 4,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  formInputMultiline: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    height: 60,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  memberSelectionContainer: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 8,
  },
  memberCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  memberCheckRowSelected: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  whiteCheckMark: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  memberCheckInfo: { flex: 1 },
  memberCheckName: { fontSize: 12, fontWeight: '600', color: '#0F172A' },
  memberCheckDept: { fontSize: 10, color: '#64748B' },
  priorityPillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  priorityPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  priorityPillActive: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  priorityPillText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  priorityPillTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  deptPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  deptPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deptPillActive: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  deptPillText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  deptPillTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  modalSubmitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  emptyBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
});
