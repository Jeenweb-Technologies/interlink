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
  Image,
  Linking,
  Keyboard,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
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
  Plus,
  Image as ImageIcon,
  Eye,
  Download,
} from 'lucide-react-native';
import { pick, types, isErrorWithCode, errorCodes, keepLocalCopy } from '@react-native-documents/picker';
import { ScreenWrapper } from '../../components/common/ScreenWrapper';
import { AppHeader } from '../../components/common/AppHeader';
import { NoPermissionView } from '../../components/common/NoPermissionView';
import { theme } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { usePermissionStore } from '../../store/permissionStore';
import { apiRequest, getApiBaseUrl, DEFAULT_API_BASE_URL } from '../../api/apiClient';
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
import { fetchDepartments, fetchAdminUsers, AdminUserItem, DepartmentItem } from '../../api/masterApi';

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
  const { hasPermission, isAdmin: isPermAdmin } = usePermissionStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super admin' || isPermAdmin;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const canReadChat = isAdmin || hasPermission('chat', 'read');

  if (!canReadChat) {
    return (
      <NoPermissionView
        moduleName="Chat & Communication"
        headerTitle="Chat"
        onBackPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('HomeTab');
          }
        }}
      />
    );
  }

  // Status bar aware safe top padding to prevent header from being cut off by status bar, notches or punch-hole cameras
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0;
  const safeThreadTop = Math.max(insets.top, statusBarHeight, Platform.OS === 'ios' ? 44 : 28) + 10;

  // Conversations & Active Thread State
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('ALL');

  // Hide bottom tab bar when inside a conversation thread
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: selectedConvId ? { display: 'none' } : undefined,
    });
    return () => {
      navigation.setOptions({ tabBarStyle: undefined });
    };
  }, [selectedConvId, navigation]);

  // Track keyboard show/hide to elevate composer cleanly
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<{ url: string; name?: string } | null>(null);
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<ChatMessage | null>(null);

  // API base url for resolving static uploaded files (uploads/...)
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(DEFAULT_API_BASE_URL);

  useEffect(() => {
    getApiBaseUrl().then((url) => {
      if (url) setApiBaseUrl(url);
    });
  }, []);

  // Directory users & depts
  const [directoryUsers, setDirectoryUsers] = useState<ChatDirectoryUser[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
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
      setLoadingDirectory(true);
      // Attempt 1: Fetch users with current active company headers
      let uRes = await getAvailableUsersForChat().catch(() => null);
      let uList = uRes?.success ? extractList<ChatDirectoryUser>(uRes, 'users') : [];

      // Attempt 2: If no users found (e.g. active company has no colleagues), fallback to Default Company 1
      if (uList.length === 0) {
        const uResCompany1 = await getAvailableUsersForChat(1).catch(() => null);
        if (uResCompany1?.success) {
          const list1 = extractList<ChatDirectoryUser>(uResCompany1, 'users');
          if (list1.length > 0) {
            uList = list1;
          }
        }
      }

      // Attempt 3: If still empty, fetch from Admin User Master (/admin/users)
      if (uList.length === 0) {
        let adminUsers: AdminUserItem[] = [];
        const adminRes = await fetchAdminUsers(false).catch(() => null);
        if (adminRes?.success && Array.isArray(adminRes.data)) {
          adminUsers = adminRes.data;
        }

        // Try direct call with company 1 header if still empty
        if (adminUsers.length === 0) {
          const adminDirectRes = await apiRequest<AdminUserItem[]>('/admin/users?includeInactive=false', {
            method: 'GET',
            headers: { 'x-company-id': '1', 'company-id': '1' },
          }).catch(() => null);
          if (adminDirectRes?.success && Array.isArray(adminDirectRes.data)) {
            adminUsers = adminDirectRes.data;
          }
        }

        if (adminUsers.length > 0) {
          uList = adminUsers
            .filter((u) => u.id !== user?.id && (u.active === 1 || u.active === true))
            .map((u) => ({
              id: u.id,
              name: u.name,
              username: u.username,
              email: u.email,
              role: u.role,
              department_name: u.type_name || u.role || 'Colleague',
              department_id: undefined,
              user_type: u.type_name || u.role,
              company_id: u.company_id,
              active: true,
            }));
        }
      }

      setDirectoryUsers(uList);

      const dRes = await fetchDepartments(false).catch(() => null);
      if (dRes?.success && Array.isArray(dRes.data)) {
        setDepartments(dRes.data);
      }
    } catch (err) {
      console.error('Error loading chat directory:', err);
    } finally {
      setLoadingDirectory(false);
    }
  }, [user?.id]);

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
      loadDirectory();
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

  // Helper to resolve full URL for uploaded files
  const getFullFileUrl = useCallback(
    (url?: string | null): string => {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      const host = apiBaseUrl.replace(/\/api\/?$/, '');
      return `${host}${url.startsWith('/') ? '' : '/'}${url}`;
    },
    [apiBaseUrl]
  );

  // Helper to check if file is an image
  const isImageFile = (fileName?: string, mime?: string): boolean => {
    if (mime && mime.toLowerCase().startsWith('image/')) return true;
    if (!fileName) return false;
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp|heic|heif)$/i.test(fileName);
  };

  // 1. Pick single image from gallery
  const handlePickGallery = async () => {
    setIsAttachmentModalOpen(false);
    try {
      const [res] = await pick({
        mode: 'open',
        type: [types.images],
        allowMultiSelection: false,
      });
      if (res && res.uri) {
        let finalUri = res.uri;
        let fileName = res.name || `image_${Date.now()}.jpg`;
        if (!fileName.includes('.')) fileName += '.jpg';

        // On Android, copy content:// to app's cache directory so OkHttp/fetch doesn't hit permission denial
        if (Platform.OS === 'android') {
          try {
            const copyRes = await keepLocalCopy({
              files: [{ uri: res.uri, fileName }],
              destination: 'cachesDirectory',
            });
            if (copyRes && copyRes[0]?.status === 'success' && copyRes[0]?.localUri) {
              finalUri = copyRes[0].localUri;
            }
          } catch (copyErr) {
            console.warn('Could not copy image to cache on Android:', copyErr);
          }
        }

        setSelectedFile({
          uri: finalUri,
          name: fileName,
          type: res.type || 'image/jpeg',
          size: res.size ?? undefined,
        });
      }
    } catch (err: unknown) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      Alert.alert('Notice', 'Could not select image from gallery');
    }
  };

  // 2. Pick single file (PDF / Word / Excel / Docs)
  const handlePickFile = async () => {
    setIsAttachmentModalOpen(false);
    try {
      const [res] = await pick({
        mode: 'open',
        type: [
          types.pdf,
          types.doc,
          types.docx,
          types.xls,
          types.xlsx,
          types.csv,
          types.plainText,
        ],
        allowMultiSelection: false,
      });
      if (res && res.uri) {
        let finalUri = res.uri;
        let fileName = res.name || `document_${Date.now()}`;

        // On Android, copy content:// to app's cache directory
        if (Platform.OS === 'android') {
          try {
            const copyRes = await keepLocalCopy({
              files: [{ uri: res.uri, fileName }],
              destination: 'cachesDirectory',
            });
            if (copyRes && copyRes[0]?.status === 'success' && copyRes[0]?.localUri) {
              finalUri = copyRes[0].localUri;
            }
          } catch (copyErr) {
            console.warn('Could not copy document to cache on Android:', copyErr);
          }
        }

        setSelectedFile({
          uri: finalUri,
          name: fileName,
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

  // 3. Document Action Handlers (View & Download)
  const handleViewDocument = async (url: string) => {
    if (!url) {
      Alert.alert('Notice', 'Document link is not available');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Notice', 'Could not open document viewer for this file.');
    }
  };

  const handleDownloadDocument = async (url: string, fileName?: string) => {
    if (!url) {
      Alert.alert('Notice', 'Document link is not available');
      return;
    }
    try {
      await Linking.openURL(url);
      Alert.alert('Download Started', `Downloading ${fileName || 'file'} in your browser.`);
    } catch {
      Alert.alert('Notice', 'Could not initiate download.');
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
      let res = await startDirectChat(targetUser.id, targetUser.company_id);
      if (!res.success && targetUser.company_id) {
        // Fallback without companyId override
        res = await startDirectChat(targetUser.id);
      }
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
    <ScreenWrapper
      dark={false}
      edges={['left', 'right']}
      statusBarStyle="light-content"
      disableKeyboardAvoiding={true}
    >
      {/* ────────────────────────────────────────────────────────
          VIEW 1: ACTIVE THREAD VIEW (MESSAGES & COMPOSER)
      ──────────────────────────────────────────────────────── */}
      {selectedConvId && activeConversation ? (
        <KeyboardAvoidingView
          style={styles.threadContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Thread Header */}
          <View style={[styles.threadHeader, { paddingTop: safeThreadTop }]}>
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

            {/* <TouchableOpacity
              style={styles.threadInfoBtn}
              onPress={() => {
                Alert.alert(
                  getConvMeta(activeConversation).name,
                  `Type: ${activeConversation.type}\n${activeConversation.description || 'Active workspace conversation thread'}`
                );
              }}
            >
              <Share2 size={16} color="#FFFFFF" />
            </TouchableOpacity> */}
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
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => {
                const isMe = item.sender_id === user?.id;
                const isBroadcast = item.is_announcement || activeConversation.type === 'BROADCAST';
                const isImg = Boolean(item.file_name || item.file_url) && isImageFile(item.file_name, item.file_mime);
                const isDoc = Boolean(item.file_name || item.file_url) && !isImg;

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
                        isDoc && styles.bubbleWithDoc,
                        isImg && styles.bubbleWithImage,
                      ]}
                    >
                      {/* Broadcast banner badge */}
                     

                      {!isMe && (
                        <Text style={styles.senderName}>{item.sender_name || 'Colleague'}</Text>
                      )}

                      {/* 1. If Image Attachment */}
                      {Boolean(item.file_name || item.file_url) && isImageFile(item.file_name, item.file_mime) && (
                        <TouchableOpacity
                          activeOpacity={0.9}
                          style={styles.messageImageCard}
                          onPress={() =>
                            setSelectedPreviewImage({
                              url: getFullFileUrl(item.file_url),
                              name: item.file_name || 'Image Preview',
                            })
                          }
                        >
                          <Image
                            source={{ uri: getFullFileUrl(item.file_url) }}
                            style={styles.messageImageThumb}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      )}

                      {/* 2. If Document Attachment */}
                      {isDoc && (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          style={[
                            styles.docAttachmentCard,
                            isMe ? styles.docAttachmentCardMe : styles.docAttachmentCardOther,
                          ]}
                          onPress={() => setSelectedPreviewDoc(item)}
                        >
                          <View
                            style={[
                              styles.docIconCircle,
                              isMe ? styles.docIconCircleMe : styles.docIconCircleOther,
                            ]}
                          >
                            <FileText size={20} color={isMe ? '#FFFFFF' : '#2563EB'} />
                          </View>
                          <View style={styles.docInfoContainer}>
                            <Text
                              style={[
                                styles.docTitleText,
                                isMe ? styles.docTitleTextMe : styles.docTitleTextOther,
                              ]}
                              numberOfLines={1}
                              ellipsizeMode="middle"
                            >
                              {(() => {
                                try {
                                  return decodeURIComponent(item.file_name || item.file_url?.split('/').pop() || 'Document');
                                } catch {
                                  return item.file_name || 'Document';
                                }
                              })()}
                            </Text>
                            <Text
                              style={[
                                styles.docSubtitleText,
                                isMe ? styles.docSubtitleTextMe : styles.docSubtitleTextOther,
                              ]}
                              numberOfLines={1}
                            >
                              {item.file_size
                                ? item.file_size > 1024 * 1024
                                  ? `${(item.file_size / (1024 * 1024)).toFixed(1)} MB`
                                  : `${(item.file_size / 1024).toFixed(1)} KB`
                                : 'Document'}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.docActionIconBox,
                              isMe ? styles.docActionIconBoxMe : styles.docActionIconBoxOther,
                            ]}
                          >
                            <Eye size={15} color={isMe ? '#FFFFFF' : '#2563EB'} />
                          </View>
                        </TouchableOpacity>
                      )}

                      {item.message_text ? (
                        <Text
                          style={[
                            styles.messageText,
                            (isDoc || isImg) && styles.messageTextWithAttachment,
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
              {isImageFile(selectedFile.name, selectedFile.type) ? (
                <ImageIcon size={14} color="#2563EB" />
              ) : (
                <FileText size={14} color="#059669" />
              )}
              <Text style={styles.selectedFileName} numberOfLines={1}>
                {selectedFile.name}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedFile(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
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
          <View
            style={[
              styles.composerContainer,
              {
                paddingBottom: isKeyboardVisible
                  ? 8
                  : Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 10),
              },
            ]}
          >
            <View style={styles.composerBar}>
              {/* Paperclip Document/Image Picker */}
              <TouchableOpacity
                style={styles.composerActionBtn}
                onPress={() => setIsAttachmentModalOpen(true)}
                accessibilityLabel="Attach Document or Image"
              >
                <Paperclip size={18} color="#64748B" />
              </TouchableOpacity>

              {/* Announcement Mode Toggle (Admin only or Broadcast channel) */}
              {/* {(isAdmin || activeConversation?.type === 'BROADCAST') && (
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
              )} */}

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
              {/* <TouchableOpacity
                style={styles.composerActionBtn}
                onPress={() => setShowEmojiPicker(!showEmojiPicker)}
                accessibilityLabel="Insert Emoji"
              >
                <Smile size={18} color="#64748B" />
              </TouchableOpacity> */}

              {/* Main Chat Text Input Field */}
              <TextInput
                style={styles.composerInput}
                placeholder={'Type here..'}
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

          {/* Search Box & Quick New Communication Button */}
          <View style={styles.searchContainer}>
            <View style={styles.searchRow}>
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

              {/* + Icon Button on the Right Side of Search Input */}
              <TouchableOpacity
                style={styles.searchAddBtn}
                onPress={() => setIsNewMenuOpen(true)}
                activeOpacity={0.8}
                accessibilityLabel="New Chat or Group"
              >
                <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
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
          <View
            style={[
              styles.actionSheet,
              {
                paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 20) + 16,
              },
            ]}
          >
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
                <UserPlus size={18} color="#2563EB" />
              </View>
              <View style={styles.actionItemTextCol}>
                <Text style={styles.actionItemTitle}>Direct</Text>
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
                <Text style={styles.actionItemTitle}>Create Group</Text>
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
          MODAL: NEW DIRECT CHAT (DIRECTORFY)
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

            {loadingDirectory ? (
              <View style={styles.modalLoadingBox}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.modalLoadingText}>Loading colleagues...</Text>
              </View>
            ) : (
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
            )}
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

      {/* ────────────────────────────────────────────────────────
          MODAL: ATTACHMENT SELECTOR (GALLERY VS FILE)
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={isAttachmentModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsAttachmentModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.attachmentModalOverlay}
          activeOpacity={1}
          onPress={() => setIsAttachmentModalOpen(false)}
        >
          <View
            style={[
              styles.attachmentModalSheet,
              {
                paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 20) + 20,
              },
            ]}
          >
            <View style={styles.attachmentModalHeader}>
              <Text style={styles.attachmentModalTitle}>Send Attachment</Text>
              <TouchableOpacity
                onPress={() => setIsAttachmentModalOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.attachmentOptionsRow}>
              {/* Option 1: Gallery */}
              <TouchableOpacity
                style={styles.attachmentOptionCard}
                onPress={handlePickGallery}
                activeOpacity={0.75}
              >
                <View style={[styles.attachmentOptionIconWrap, { backgroundColor: '#EFF6FF' }]}>
                  <ImageIcon size={26} color="#2563EB" />
                </View>
                <Text style={styles.attachmentOptionLabel}>Gallery</Text>
                <Text style={styles.attachmentOptionSub}>Single Image</Text>
              </TouchableOpacity>

              {/* Option 2: File */}
              <TouchableOpacity
                style={styles.attachmentOptionCard}
                onPress={handlePickFile}
                activeOpacity={0.75}
              >
                <View style={[styles.attachmentOptionIconWrap, { backgroundColor: '#ECFDF5' }]}>
                  <FileText size={26} color="#059669" />
                </View>
                <Text style={styles.attachmentOptionLabel}>File</Text>
                <Text style={styles.attachmentOptionSub}>PDF / Word / Excel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ────────────────────────────────────────────────────────
          MODAL: FULLSCREEN BIG IMAGE PREVIEW (RIGHT CLOSE ICON)
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={Boolean(selectedPreviewImage)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedPreviewImage(null)}
      >
        <View style={styles.imageModalBackdrop}>
          <View style={styles.imageModalHeader}>
            <Text style={styles.imageModalFileName} numberOfLines={1}>
              {selectedPreviewImage?.name || 'Image Preview'}
            </Text>
            <TouchableOpacity
              style={styles.imageModalCloseBtn}
              onPress={() => setSelectedPreviewImage(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.imageModalImageContainer}>
            {Boolean(selectedPreviewImage?.url) && (
              <Image
                source={{ uri: selectedPreviewImage?.url }}
                style={styles.imageModalBigImage}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ────────────────────────────────────────────────────────
          MODAL: DOCUMENT ACTIONS (VIEW AND DOWNLOAD BUTTONS)
      ──────────────────────────────────────────────────────── */}
      <Modal
        visible={Boolean(selectedPreviewDoc)}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedPreviewDoc(null)}
      >
        <TouchableOpacity
          style={styles.docModalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedPreviewDoc(null)}
        >
          <View
            style={[
              styles.docModalSheet,
              {
                paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 20) + 20,
              },
            ]}
          >
            <View style={styles.docModalHeader}>
              <View style={styles.docModalFileMetaRow}>
                <View style={styles.docModalFileIconWrap}>
                  <FileText size={22} color="#2563EB" />
                </View>
                <View style={styles.docModalFileDetails}>
                  <Text style={styles.docModalFileName} numberOfLines={2}>
                    {(() => {
                      try {
                        return decodeURIComponent(
                          selectedPreviewDoc?.file_name ||
                            selectedPreviewDoc?.file_url?.split('/').pop() ||
                            'Document'
                        );
                      } catch {
                        return selectedPreviewDoc?.file_name || 'Document';
                      }
                    })()}
                  </Text>
                  <Text style={styles.docModalFileSize}>
                    {selectedPreviewDoc?.file_size
                      ? selectedPreviewDoc.file_size > 1024 * 1024
                        ? `${(selectedPreviewDoc.file_size / (1024 * 1024)).toFixed(1)} MB`
                        : `${(selectedPreviewDoc.file_size / 1024).toFixed(1)} KB`
                      : 'Attachment Document'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedPreviewDoc(null)}
                style={styles.docModalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.docModalButtonsRow}>
              {/* View Button */}
              <TouchableOpacity
                style={styles.docViewActionBtn}
                activeOpacity={0.8}
                onPress={() => {
                  const url = getFullFileUrl(selectedPreviewDoc?.file_url);
                  handleViewDocument(url);
                }}
              >
                <Eye size={18} color="#FFFFFF" />
                <Text style={styles.docViewActionText}>View Document</Text>
              </TouchableOpacity>

              {/* Download Button */}
              <TouchableOpacity
                style={styles.docDownloadActionBtn}
                activeOpacity={0.8}
                onPress={() => {
                  const url = getFullFileUrl(selectedPreviewDoc?.file_url);
                  handleDownloadDocument(url, selectedPreviewDoc?.file_name);
                }}
              >
                <Download size={18} color="#17365D" />
                <Text style={styles.docDownloadActionText}>Download</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
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
  bubbleWithDoc: {
    width: 270,
    maxWidth: '85%',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
  },
  bubbleWithImage: {
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 6,
  },
  messageTextWithAttachment: {
    marginTop: 6,
    paddingHorizontal: 4,
    marginBottom: 2,
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
    marginTop: 14,
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  searchAddBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#17365D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#17365D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
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
  modalLoadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
  },

  // Message Image Thumbnail
  messageImageCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 6,
    backgroundColor: '#00000008',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  messageImageThumb: {
    width: 220,
    height: 160,
    borderRadius: 12,
  },

  // Message Document Card
  docAttachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 4,
    width: '100%',
  },
  docAttachmentCardMe: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  docAttachmentCardOther: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  docIconCircleMe: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  docIconCircleOther: {
    backgroundColor: '#EFF6FF',
  },
  docInfoContainer: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
    justifyContent: 'center',
    minWidth: 0,
  },
  docTitleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  docTitleTextMe: {
    color: '#FFFFFF',
  },
  docTitleTextOther: {
    color: '#0F172A',
  },
  docSubtitleText: {
    fontSize: 11,
    marginTop: 2,
  },
  docSubtitleTextMe: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  docSubtitleTextOther: {
    color: '#64748B',
  },
  docActionIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  docActionIconBoxMe: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  docActionIconBoxOther: {
    backgroundColor: '#EFF6FF',
  },

  // Attachment Modal (Gallery vs File)
  attachmentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  attachmentModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  attachmentModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 16,
  },
  attachmentModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  attachmentOptionsRow: {
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
  },
  attachmentOptionCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentOptionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  attachmentOptionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  attachmentOptionSub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },

  // Fullscreen Big Image Modal
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
  },
  imageModalHeader: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  imageModalFileName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  imageModalCloseBtn: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
  },
  imageModalImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  imageModalBigImage: {
    width: '100%',
    height: '100%',
  },

  // Document Modal (View & Download)
  docModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  docModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 52 : 32,
  },
  docModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 16,
  },
  docModalFileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    marginRight: 10,
  },
  docModalFileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docModalFileDetails: {
    flex: 1,
  },
  docModalFileName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  docModalFileSize: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  docModalCloseBtn: {
    padding: 4,
  },
  docModalButtonsRow: {
    flexDirection: 'column',
    gap: 10,
  },
  docViewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
  },
  docViewActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  docDownloadActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    paddingVertical: 14,
  },
  docDownloadActionText: {
    color: '#17365D',
    fontSize: 14,
    fontWeight: '700',
  },
});
