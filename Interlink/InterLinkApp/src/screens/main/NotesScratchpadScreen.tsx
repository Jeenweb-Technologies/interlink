import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import {
  Plus,
  Search,
  Pin,
  FileText,
  Lock,
  Users,
  Clock,
  Trash2,
  X,
  Share2,
  Pencil,
  SquareCheck,
  Square,
  Link2,
  Paperclip,
  Tag,
  Check,
  ChevronDown,
  Calendar,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { AppHeader } from '../../components/common/AppHeader';
import { NoPermissionView } from '../../components/common/NoPermissionView';
import { usePermissionStore } from '../../store/permissionStore';
import { theme } from '../../constants/theme';
import {
  fetchNotes,
  fetchNoteById,
  createNoteApi,
  updateNoteApi,
  deleteNoteApi,
  togglePinNoteApi,
  toggleChecklistItemApi,
  fetchCollaboratorsMetaApi,
  shareNoteApi,
  revokeNoteShareApi,
  fetchLinkableEntitiesApi,
  addNoteLinkApi,
  deleteNoteLinkApi,
  uploadNoteAttachmentApi,
  deleteNoteAttachmentApi,
  NoteItem,
  ChecklistItem,
  NoteAttachment,
  NoteLink,
  NoteShare,
  CollaboratorUser,
  CollaboratorGroup,
  LinkableEntitiesData,
} from '../../api/noteApi';
import { useAuthStore } from '../../store/authStore';

// Helper to strip HTML tags to clean plain text
export const stripHtml = (html?: string): string => {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
};

export const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

type NoteScope = 'my_notes' | 'shared_with_me' | 'archived';

interface TabConfig {
  key: NoteScope;
  label: string;
}

const TABS: TabConfig[] = [
  { key: 'my_notes', label: 'My Notes' },
  { key: 'shared_with_me', label: 'Shared with me' },
  { key: 'archived', label: 'Archived' },
];

const COLOR_OPTIONS = [
  { hex: '#FFFFFF', label: 'White' },
  { hex: '#FEF3C7', label: 'Amber' },
  { hex: '#D1FAE5', label: 'Emerald' },
  { hex: '#E0F2FE', label: 'Sky' },
  { hex: '#F3E8FF', label: 'Purple' },
  { hex: '#FFE4E6', label: 'Rose' },
];

const EDITOR_BG_STYLES: Record<string, { backgroundColor: string }> = {
  '#FFFFFF': { backgroundColor: '#FFFFFF' },
  '#FEF3C7': { backgroundColor: '#FEF3C7' },
  '#D1FAE5': { backgroundColor: '#D1FAE5' },
  '#E0F2FE': { backgroundColor: '#E0F2FE' },
  '#F3E8FF': { backgroundColor: '#F3E8FF' },
  '#FFE4E6': { backgroundColor: '#FFE4E6' },
};

const PRIORITY_OPTIONS: Array<{
  key: 'low' | 'medium' | 'high' | 'urgent';
  label: string;
  bg: string;
  text: string;
  border: string;
}> = [
  { key: 'urgent', label: 'Urgent', bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
  { key: 'high', label: 'High', bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  { key: 'medium', label: 'Medium', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  { key: 'low', label: 'Low', bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' },
];

interface LocalPendingAttachment {
  uri: string;
  name: string;
  size: number;
  type: string;
}

export const NotesScratchpadScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { hasPermission, isAdmin } = usePermissionStore();

  const canReadNotes =
    isAdmin ||
    user?.role === 'admin' ||
    user?.role === 'super admin' ||
    hasPermission('notes', 'read');

  if (!canReadNotes) {
    return (
      <NoPermissionView
        moduleName="Notes & Scratchpad"
        headerTitle="Notes"
        onBackPress={() => navigation.goBack()}
      />
    );
  }

  const [activeTab, setActiveTab] = useState<NoteScope>('my_notes');
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Share & Permissions Modal State ──────────────────────────────
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareTargetNote, setShareTargetNote] = useState<NoteItem | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [sharesList, setSharesList] = useState<NoteShare[]>([]);
  const [availableUsers, setAvailableUsers] = useState<CollaboratorUser[]>([]);
  const [availableGroups, setAvailableGroups] = useState<CollaboratorGroup[]>([]);
  const [shareTargetType, setShareTargetType] = useState<'user' | 'group'>('user');
  const [selectedTargetId, setSelectedTargetId] = useState<string | number>('');
  const [sharePermission, setSharePermission] = useState<'view' | 'comment' | 'edit'>('view');
  const [shareExpiresAt, setShareExpiresAt] = useState('');
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);

  // ─── Note Editor Modal State (New / Edit) ──────────────────────────
  const [editorModalVisible, setEditorModalVisible] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editorVersion, setEditorVersion] = useState<number>(1);
  const [editorLoading, setEditorLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  // Form Fields
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [notePriority, setNotePriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [noteColor, setNoteColor] = useState('#FFFFFF');
  const [notePinned, setNotePinned] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);

  // 1. Actionable Checklist
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');

  // 2. Linked Work Items
  const [links, setLinks] = useState<NoteLink[]>([]);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkableEntities, setLinkableEntities] = useState<LinkableEntitiesData>({
    tasks: [],
    projects: [],
  });
  const [selectedEntityType, setSelectedEntityType] = useState<'task' | 'project'>('task');
  const [selectedEntityId, setSelectedEntityId] = useState<string | number>('');
  const [showEntityDropdown, setShowEntityDropdown] = useState(false);

  // 3. Attachments & Document
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [localPendingAttachments, setLocalPendingAttachments] = useState<LocalPendingAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // 4. Labels
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');

  // Load Notes
  const loadNotes = useCallback(async (scope: NoteScope) => {
    try {
      setLoading(true);
      const res = await fetchNotes({ scope });
      if (res.success) {
        const rawList =
          (res as any).notes ||
          res.data?.notes ||
          (Array.isArray(res.data) ? res.data : []);
        setNotes(Array.isArray(rawList) ? rawList : []);
      } else {
        setNotes([]);
      }
    } catch (err) {
      console.error('Failed to load notes:', err);
      setNotes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotes(activeTab);
  }, [activeTab, loadNotes]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotes(activeTab);
  };

  // Toggle Pin
  const handleTogglePin = async (noteId: number) => {
    try {
      const res = await togglePinNoteApi(noteId);
      if (res.success) {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === noteId ? { ...n, is_pinned: Boolean(res.data?.is_pinned) } : n
          )
        );
      }
    } catch (err) {
      console.error('Error toggling pin:', err);
      Alert.alert('Error', 'Failed to toggle pin on this note.');
    }
  };

  // Delete Note
  const handleDeleteNote = (noteId: number) => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await deleteNoteApi(noteId);
            if (res.success) {
              setNotes((prev) => prev.filter((n) => n.id !== noteId));
            } else {
              Alert.alert('Error', res.message || 'Failed to delete note.');
            }
          } catch (err) {
            console.error('Delete note error:', err);
            Alert.alert('Error', 'Failed to delete note.');
          }
        },
      },
    ]);
  };

  // ─── Open Share & Permissions Modal ──────────────────────────────
  const openShareModal = async (note: NoteItem) => {
    setShareTargetNote(note);
    setShareModalVisible(true);
    setShareLoading(true);
    setShowTargetDropdown(false);
    setShareExpiresAt('');
    setSharePermission('view');

    try {
      const [noteDetailsRes, metaRes] = await Promise.all([
        fetchNoteById(note.id).catch(() => null),
        fetchCollaboratorsMetaApi().catch(() => null),
      ]);

      if (noteDetailsRes && noteDetailsRes.success && noteDetailsRes.data?.note) {
        setSharesList(noteDetailsRes.data.note.shares || []);
      } else {
        setSharesList(note.shares || []);
      }

      if (metaRes && metaRes.success && metaRes.data) {
        setAvailableUsers(metaRes.data.users || []);
        setAvailableGroups(metaRes.data.groups || []);
        if (metaRes.data.users && metaRes.data.users.length > 0) {
          setSelectedTargetId(metaRes.data.users[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load sharing details:', err);
      Alert.alert('Error', 'Failed to load collaborator details.');
    } finally {
      setShareLoading(false);
    }
  };

  // Add Share Submit
  const handleAddShareSubmit = async () => {
    if (!shareTargetNote) return;
    if (!selectedTargetId) {
      Alert.alert('Selection Required', 'Please select a user or group.');
      return;
    }

    try {
      setShareSubmitting(true);
      const payload: {
        userId?: number | string;
        userTypeId?: number | string;
        permission: 'view' | 'comment' | 'edit';
        expiresAt?: string | null;
      } = {
        permission: sharePermission,
        expiresAt: shareExpiresAt.trim() || null,
      };

      if (shareTargetType === 'user') {
        payload.userId = selectedTargetId;
      } else {
        payload.userTypeId = selectedTargetId;
      }

      const res = await shareNoteApi(shareTargetNote.id, payload);
      if (res.success) {
        Alert.alert('Success', 'Note shared successfully!');
        // Refresh share list
        const refreshRes = await fetchNoteById(shareTargetNote.id);
        if (refreshRes.success && refreshRes.data?.note) {
          setSharesList(refreshRes.data.note.shares || []);
        }
        setShareExpiresAt('');
        loadNotes(activeTab);
      } else {
        Alert.alert('Error', res.message || 'Failed to share note.');
      }
    } catch (err) {
      console.error('Error sharing note:', err);
      Alert.alert('Error', 'Failed to share note.');
    } finally {
      setShareSubmitting(false);
    }
  };

  // Revoke Share
  const handleRevokeShare = (shareId: number, name: string) => {
    if (!shareTargetNote) return;
    Alert.alert(
      'Revoke Access',
      `Revoke access for "${name}" immediately?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await revokeNoteShareApi(shareTargetNote.id, shareId);
              if (res.success) {
                setSharesList((prev) => prev.filter((s) => s.id !== shareId));
                loadNotes(activeTab);
              } else {
                Alert.alert('Error', res.message || 'Failed to revoke access.');
              }
            } catch (err) {
              console.error('Error revoking share:', err);
              Alert.alert('Error', 'Failed to revoke access.');
            }
          },
        },
      ]
    );
  };

  // ─── Open Note Editor Modal (Create or Edit) ──────────────────────
  const openCreateModal = () => {
    setEditingNoteId(null);
    setEditorVersion(1);
    setNoteTitle('');
    setNoteContent('');
    setNotePriority('medium');
    setNoteColor('#FFFFFF');
    setNotePinned(false);
    setChecklists([]);
    setNewChecklistText('');
    setLinks([]);
    setLinkPickerOpen(false);
    setAttachments([]);
    setLocalPendingAttachments([]);
    setLabels([]);
    setLabelInput('');
    setShowPriorityDropdown(false);
    setShowColorDropdown(false);
    setEditorModalVisible(true);
  };

  const openEditModal = async (note: NoteItem) => {
    setEditingNoteId(note.id);
    setEditorVersion(note.version || 1);
    setNoteTitle(note.title || '');
    setNoteContent(stripHtml(note.content || ''));
    setNotePriority(note.priority || 'medium');
    setNoteColor(note.color || '#FFFFFF');
    setNotePinned(Boolean(note.is_pinned));
    setChecklists([]);
    setNewChecklistText('');
    setLinks([]);
    setLinkPickerOpen(false);
    setAttachments([]);
    setLocalPendingAttachments([]);
    setLabels(Array.isArray(note.labels) ? note.labels : []);
    setLabelInput('');
    setShowPriorityDropdown(false);
    setShowColorDropdown(false);
    setEditorModalVisible(true);
    setEditorLoading(true);

    try {
      const res = await fetchNoteById(note.id);
      if (res.success && res.data?.note) {
        const full = res.data.note;
        setNoteTitle(full.title || '');
        setNoteContent(stripHtml(full.content || ''));
        setNotePriority(full.priority || 'medium');
        setNoteColor(full.color || '#FFFFFF');
        setNotePinned(Boolean(full.is_pinned));
        setEditorVersion(full.version || 1);
        setChecklists(full.checklists || []);
        setAttachments(full.attachments || []);
        setLinks(full.links || []);
        setLabels(Array.isArray(full.labels) ? full.labels : []);
      }
    } catch (err) {
      console.error('Failed to load note details for editing:', err);
    } finally {
      setEditorLoading(false);
    }
  };

  // Checklist handlers
  const handleAddChecklist = () => {
    if (!newChecklistText.trim()) return;
    setChecklists((prev) => [
      ...prev,
      {
        id: Date.now(),
        item_text: newChecklistText.trim(),
        is_completed: false,
      },
    ]);
    setNewChecklistText('');
  };

  const handleToggleChecklist = async (index: number) => {
    const item = checklists[index];
    const newCompleted = !item.is_completed;
    setChecklists((prev) =>
      prev.map((c, i) => (i === index ? { ...c, is_completed: newCompleted } : c))
    );

    // If editing existing note and item has real DB id, persist toggle to backend
    if (editingNoteId && item.id && item.id < 1000000000) {
      try {
        await toggleChecklistItemApi(editingNoteId, item.id);
      } catch (err) {
        console.error('Failed to toggle checklist on server:', err);
      }
    }
  };

  const handleDeleteChecklist = (index: number) => {
    setChecklists((prev) => prev.filter((_, i) => i !== index));
  };

  // Label handlers
  const handleAddLabel = () => {
    const clean = labelInput.trim().replace(/^#/, '');
    if (clean && !labels.includes(clean)) {
      setLabels((prev) => [...prev, clean]);
    }
    setLabelInput('');
  };

  const handleRemoveLabel = (lbl: string) => {
    setLabels((prev) => prev.filter((l) => l !== lbl));
  };

  // Link Work Item handlers
  const handleOpenLinkPicker = async () => {
    setLinkPickerOpen(true);
    setShowEntityDropdown(false);
    if (
      linkableEntities.tasks.length === 0 &&
      linkableEntities.projects.length === 0
    ) {
      try {
        const res = await fetchLinkableEntitiesApi();
        if (res.success && res.data) {
          setLinkableEntities(res.data);
          if (res.data.tasks && res.data.tasks.length > 0) {
            setSelectedEntityId(res.data.tasks[0].id);
          } else if (res.data.projects && res.data.projects.length > 0) {
            setSelectedEntityId(res.data.projects[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load linkable entities:', err);
      }
    }
  };

  const handleAttachEntityLink = async () => {
    if (!selectedEntityId) return;

    let titleStr = '';
    if (selectedEntityType === 'task') {
      const t = linkableEntities.tasks.find((x) => String(x.id) === String(selectedEntityId));
      titleStr = t ? `[${t.task_code}] ${t.title}` : `Task #${selectedEntityId}`;
    } else {
      const p = linkableEntities.projects.find((x) => String(x.id) === String(selectedEntityId));
      titleStr = p ? `[${p.project_code || 'PRJ'}] ${p.title}` : `Project #${selectedEntityId}`;
    }

    if (editingNoteId) {
      try {
        await addNoteLinkApi(editingNoteId, {
          entity_type: selectedEntityType,
          entity_id: selectedEntityId,
          title: titleStr,
        });
        setLinks((prev) => [
          ...prev,
          {
            entity_type: selectedEntityType,
            entity_id: selectedEntityId,
            title: titleStr,
          },
        ]);
        setLinkPickerOpen(false);
      } catch (err) {
        console.error('Error adding link:', err);
        Alert.alert('Error', 'Failed to link item.');
      }
    } else {
      setLinks((prev) => [
        ...prev,
        {
          entity_type: selectedEntityType,
          entity_id: selectedEntityId,
          title: titleStr,
        },
      ]);
      setLinkPickerOpen(false);
    }
  };

  const handleDeleteEntityLink = async (linkItem: NoteLink, index: number) => {
    if (editingNoteId && linkItem.id) {
      try {
        await deleteNoteLinkApi(editingNoteId, linkItem.id);
        setLinks((prev) => prev.filter((l) => l.id !== linkItem.id));
      } catch (err) {
        console.error('Error deleting link:', err);
        Alert.alert('Error', 'Failed to remove link.');
      }
    } else {
      setLinks((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Attachment Document handlers with @react-native-documents/picker
  const handlePickDocument = async () => {
    try {
      const [picked] = await pick({
        type: [types.allFiles],
      });

      if (!picked) return;

      const fileObj = {
        uri: picked.uri,
        name: picked.name || 'document',
        size: picked.size || 0,
        type: picked.type || 'application/octet-stream',
      };

      if (editingNoteId) {
        // Upload immediately to existing note
        setUploadingAttachment(true);
        const formData = new FormData();
        formData.append('file', fileObj as any);

        const res = await uploadNoteAttachmentApi(editingNoteId, formData);
        if (res.success && res.data?.attachment) {
          setAttachments((prev) => [res.data!.attachment, ...prev]);
        } else {
          Alert.alert('Error', res.message || 'Failed to upload attachment.');
        }
      } else {
        // Stage local pending attachment for new note
        setLocalPendingAttachments((prev) => [...prev, fileObj]);
      }
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        // User cancelled picker, do nothing
        return;
      }
      console.error('Document picker error:', err);
      Alert.alert('Picker Error', 'Unable to pick document.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (attId: number) => {
    if (!editingNoteId) return;
    Alert.alert('Delete Attachment', 'Are you sure you want to remove this file?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await deleteNoteAttachmentApi(editingNoteId, attId);
            if (res.success) {
              setAttachments((prev) => prev.filter((a) => a.id !== attId));
            } else {
              Alert.alert('Error', res.message || 'Failed to delete file.');
            }
          } catch (err) {
            console.error('Error deleting attachment:', err);
            Alert.alert('Error', 'Failed to delete file.');
          }
        },
      },
    ]);
  };

  const handleDeleteLocalPendingAttachment = (index: number) => {
    setLocalPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Save Note (Create or Update)
  const handleSaveNote = async () => {
    if (!noteTitle.trim()) {
      Alert.alert('Required Field', 'Please enter a note title.');
      return;
    }

    try {
      setSavingNote(true);
      if (editingNoteId) {
        // Update existing note
        const res = await updateNoteApi(editingNoteId, {
          title: noteTitle.trim(),
          content: noteContent.trim(),
          color: noteColor,
          priority: notePriority,
          labels,
          is_pinned: notePinned,
          checklists,
          version: editorVersion,
        });

        if (res.success) {
          setEditorModalVisible(false);
          loadNotes(activeTab);
        } else {
          Alert.alert('Error', res.message || 'Failed to update note.');
        }
      } else {
        // Create new note
        const res = await createNoteApi({
          title: noteTitle.trim(),
          content: noteContent.trim(),
          color: noteColor,
          priority: notePriority,
          labels,
          is_pinned: notePinned,
          checklists,
          links,
        });

        if (res.success) {
          const newId = res.noteId || res.data?.noteId;
          // If there were local attachments staged, upload them now
          if (newId && localPendingAttachments.length > 0) {
            for (const localAtt of localPendingAttachments) {
              const formData = new FormData();
              formData.append('file', localAtt as any);
              await uploadNoteAttachmentApi(newId, formData).catch(() => null);
            }
          }

          setEditorModalVisible(false);
          loadNotes(activeTab);
        } else {
          Alert.alert('Error', res.message || 'Failed to create note.');
        }
      }
    } catch (err) {
      console.error('Error saving note:', err);
      Alert.alert('Error', 'An unexpected error occurred while saving the note.');
    } finally {
      setSavingNote(false);
    }
  };

  // Filter notes by search query
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) =>
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.content && n.content.toLowerCase().includes(q))
    );
  }, [notes, searchQuery]);

  // Separate pinned from unpinned
  const displayedNotes = useMemo(() => {
    const pinned: NoteItem[] = [];
    const regular: NoteItem[] = [];
    filteredNotes.forEach((item) => {
      if (item.is_pinned) pinned.push(item);
      else regular.push(item);
    });
    return [...pinned, ...regular];
  }, [filteredNotes]);

  // Render Note Card
  const renderNoteCard = ({ item }: { item: NoteItem }) => {
    const isOwner = item.my_permission === 'owner' || item.owner_id === user?.id;
    const priorityMeta =
      PRIORITY_OPTIONS.find((p) => p.key === item.priority) || PRIORITY_OPTIONS[2];
    const cardBg = item.color && item.color !== '#FFFFFF' ? item.color : '#FFFFFF';
    const plainSnippet = stripHtml(item.content);

    return (
      <View
        style={[
          styles.noteCard,
          { backgroundColor: cardBg },
          item.is_pinned && styles.noteCardPinned,
        ]}
      >
        {/* Top Header: Priority Badge, Ownership/Shared Badge, Action Icons */}
        <View style={styles.cardHeader}>
          <View style={styles.badgeRow}>
            {/* Priority Badge */}
            <View
              style={[
                styles.priorityBadge,
                {
                  backgroundColor: priorityMeta.bg,
                  borderColor: priorityMeta.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.priorityBadgeText,
                  { color: priorityMeta.text },
                ]}
              >
                {priorityMeta.label}
              </Text>
            </View>

            {/* Sharing / Private indicator */}
            {isOwner ? (
              Number(item.shares_count) > 0 ? (
                <View style={styles.shareBadge}>
                  <Share2 size={11} color="#4338CA" />
                  <Text style={styles.shareBadgeText}>
                    Shared ({item.shares_count})
                  </Text>
                </View>
              ) : (
                <View style={styles.privateBadge}>
                  <Lock size={10} color="#64748B" />
                  <Text style={styles.privateBadgeText}>Private</Text>
                </View>
              )
            ) : (
              <View style={styles.sharedWithMeBadge}>
                <Users size={11} color="#0369A1" />
                <Text style={styles.sharedWithMeBadgeText} numberOfLines={1}>
                  {item.owner_name || 'Shared'}
                </Text>
              </View>
            )}
          </View>

          {/* Action Row: Share, Edit, Delete, Pin */}
          <View style={styles.actionRow}>
            {/* Pin Button */}
            <TouchableOpacity
              onPress={() => handleTogglePin(item.id)}
              activeOpacity={0.7}
              style={[
                styles.iconButton,
                item.is_pinned && styles.iconButtonPinned,
              ]}
              hitSlop={styles.hitSlop8}
              accessibilityLabel="Pin Note"
            >
              <Pin
                size={14}
                color={item.is_pinned ? '#2878C7' : '#94A3B8'}
                fill={item.is_pinned ? '#2878C7' : 'none'}
              />
            </TouchableOpacity>

            {/* Share Icon */}
            <TouchableOpacity
              onPress={() => openShareModal(item)}
              activeOpacity={0.7}
              style={styles.iconButton}
              hitSlop={styles.hitSlop8}
              accessibilityLabel="Share and Permissions"
            >
              <Share2 size={14} color="#17365D" />
            </TouchableOpacity>

            {/* Edit Icon */}
            <TouchableOpacity
              onPress={() => openEditModal(item)}
              activeOpacity={0.7}
              style={styles.iconButton}
              hitSlop={styles.hitSlop8}
              accessibilityLabel="Edit Note"
            >
              <Pencil size={14} color="#2563EB" />
            </TouchableOpacity>

            {/* Delete Icon (Owner only) */}
            {isOwner && (
              <TouchableOpacity
                onPress={() => handleDeleteNote(item.id)}
                activeOpacity={0.7}
                style={styles.iconButton}
                hitSlop={styles.hitSlop8}
                accessibilityLabel="Delete Note"
              >
                <Trash2 size={14} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Note Title */}
        <Text style={styles.noteTitle} numberOfLines={2}>
          {item.title}
        </Text>

        {/* Note Body Content Snippet */}
        <Text style={styles.noteSnippet} numberOfLines={3}>
          {plainSnippet || 'No additional text content...'}
        </Text>

        {/* Labels / Tags */}
        {Array.isArray(item.labels) && item.labels.length > 0 && (
          <View style={styles.cardLabelsRow}>
            {item.labels.slice(0, 3).map((lbl, idx) => (
              <View key={idx} style={styles.cardLabelPill}>
                <Text style={styles.cardLabelText}>#{lbl}</Text>
              </View>
            ))}
            {item.labels.length > 3 && (
              <Text style={styles.cardLabelMore}>+{item.labels.length - 3}</Text>
            )}
          </View>
        )}

        {/* Card Footer: Checklists, Attachments, Links, Date */}
        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            {Number(item.total_checklists) > 0 && (
              <View style={styles.checklistBadge}>
                <SquareCheck size={11} color="#15803D" />
                <Text style={styles.checklistBadgeText}>
                  {item.completed_checklists || 0}/{item.total_checklists}
                </Text>
              </View>
            )}

            {Number(item.attachments_count) > 0 && (
              <View style={styles.metricBadge}>
                <Paperclip size={11} color="#64748B" />
                <Text style={styles.metricBadgeText}>{item.attachments_count}</Text>
              </View>
            )}

            {Number(item.links_count) > 0 && (
              <View style={styles.metricBadge}>
                <Link2 size={11} color="#2563EB" />
                <Text style={styles.metricBadgeText}>{item.links_count}</Text>
              </View>
            )}

            <View style={styles.dateBadge}>
              <Clock size={11} color="#94A3B8" />
              <Text style={styles.dateBadgeText}>
                {formatDate(item.updated_at || item.created_at)}
              </Text>
            </View>
          </View>

          {item.is_pinned && (
            <View style={styles.pinnedPill}>
              <Text style={styles.pinnedPillText}>Pinned</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screenContainer}>
      {/* Reusable AppHeader with curved bottom-left corner */}
      <AppHeader
        title="Notes & Scratchpad"
        onBackPress={() => navigation.goBack()}
        showBack={true}
        rightElement={
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={openCreateModal}
            activeOpacity={0.7}
            hitSlop={styles.hitSlop10}
            accessibilityLabel="Create Note"
          >
            <Plus size={20} color="#FFFFFF" strokeWidth={2.6} />
          </TouchableOpacity>
        }
      />

      {/* 3 Tab Switcher Bar: "My Notes", "Shared with me", "Archived" */}
      <View style={styles.tabBarContainer}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  isActive && styles.tabButtonTextActive,
                ]}
              >
                {tab.label}
              </Text>
              {isActive && <View style={styles.tabActiveIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Search size={16} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes or keywords..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={styles.hitSlop8}
            >
              <X size={15} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main Content List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Loading notes...</Text>
        </View>
      ) : displayedNotes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <FileText size={36} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>
            {activeTab === 'my_notes'
              ? 'No notes yet'
              : activeTab === 'shared_with_me'
              ? 'No shared notes'
              : 'No archived notes'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'No notes match your current search.'
              : activeTab === 'my_notes'
              ? 'Capture thoughts, to-do checklists, linked work items, and scratchpad ideas.'
              : 'Notes shared with you by teammates will appear here.'}
          </Text>
          {activeTab === 'my_notes' && (
            <TouchableOpacity
              style={styles.emptyCreateBtn}
              onPress={openCreateModal}
              activeOpacity={0.8}
            >
              <Plus size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.emptyCreateBtnText}>Create Note</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={displayedNotes}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderNoteCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.accent]}
              tintColor={theme.colors.accent}
            />
          }
        />
      )}

      {/* ────────────────────────────────────────────────────────────────
          SHARE & PERMISSIONS MODAL
      ──────────────────────────────────────────────────────────────── */}
      <Modal
        visible={shareModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.shareModalSheet}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.shareTitleWrap}>
                <View style={styles.shareHeaderIcon}>
                  <Users size={18} color="#2878C7" />
                </View>
                <View style={styles.shareHeaderTextCol}>
                  <Text style={styles.modalTitle}>Share & Permissions</Text>
                  <Text style={styles.shareNoteSubtitle} numberOfLines={1}>
                    "{shareTargetNote?.title || 'Note'}"
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShareModalVisible(false)}
                hitSlop={styles.hitSlop8}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {shareLoading ? (
                <View style={styles.shareModalLoading}>
                  <ActivityIndicator size="small" color="#17365D" />
                  <Text style={styles.shareModalLoadingText}>Loading collaborator details...</Text>
                </View>
              ) : (
                <>
                  {/* Invite New Collaborator Card */}
                  <View style={styles.inviteSection}>
                    <Text style={styles.sectionHeaderTitle}>Invite New Collaborator</Text>

                    {/* Target Type Switcher: User vs Group */}
                    <View style={styles.targetTypeSwitcher}>
                      <TouchableOpacity
                        style={[
                          styles.targetTypeBtn,
                          shareTargetType === 'user' && styles.targetTypeBtnActive,
                        ]}
                        onPress={() => {
                          setShareTargetType('user');
                          if (availableUsers.length > 0) setSelectedTargetId(availableUsers[0].id);
                        }}
                      >
                        <Text
                          style={[
                            styles.targetTypeText,
                            shareTargetType === 'user' && styles.targetTypeTextActive,
                          ]}
                        >
                          User
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.targetTypeBtn,
                          shareTargetType === 'group' && styles.targetTypeBtnActive,
                        ]}
                        onPress={() => {
                          setShareTargetType('group');
                          if (availableGroups.length > 0) setSelectedTargetId(availableGroups[0].id);
                        }}
                      >
                        <Text
                          style={[
                            styles.targetTypeText,
                            shareTargetType === 'group' && styles.targetTypeTextActive,
                          ]}
                        >
                          Group
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Selector for Target (User or Group) */}
                    <TouchableOpacity
                      style={styles.selectDropdownBtn}
                      onPress={() => setShowTargetDropdown(!showTargetDropdown)}
                    >
                      <Text style={styles.selectDropdownBtnText} numberOfLines={1}>
                        {shareTargetType === 'user'
                          ? availableUsers.find((u) => String(u.id) === String(selectedTargetId))
                              ?.name || 'Select a user...'
                          : availableGroups.find((g) => String(g.id) === String(selectedTargetId))
                              ?.type_name || 'Select a group...'}
                      </Text>
                      <ChevronDown size={14} color="#64748B" />
                    </TouchableOpacity>

                    {showTargetDropdown && (
                      <View style={styles.dropdownList}>
                        {shareTargetType === 'user'
                          ? availableUsers.map((u) => (
                              <TouchableOpacity
                                key={u.id}
                                style={[
                                  styles.dropdownItem,
                                  String(selectedTargetId) === String(u.id) &&
                                    styles.dropdownItemActive,
                                ]}
                                onPress={() => {
                                  setSelectedTargetId(u.id);
                                  setShowTargetDropdown(false);
                                }}
                              >
                                <Text style={styles.dropdownItemText}>{u.name}</Text>
                                <Text style={styles.dropdownItemSubText}>{u.email}</Text>
                              </TouchableOpacity>
                            ))
                          : availableGroups.map((g) => (
                              <TouchableOpacity
                                key={g.id}
                                style={[
                                  styles.dropdownItem,
                                  String(selectedTargetId) === String(g.id) &&
                                    styles.dropdownItemActive,
                                ]}
                                onPress={() => {
                                  setSelectedTargetId(g.id);
                                  setShowTargetDropdown(false);
                                }}
                              >
                                <Text style={styles.dropdownItemText}>{g.type_name}</Text>
                              </TouchableOpacity>
                            ))}
                      </View>
                    )}

                    {/* Permission Selector */}
                    <View style={styles.permissionRow}>
                      {(['view', 'comment', 'edit'] as const).map((perm) => {
                        const isSelected = sharePermission === perm;
                        return (
                          <TouchableOpacity
                            key={perm}
                            style={[
                              styles.permPill,
                              isSelected && styles.permPillActive,
                            ]}
                            onPress={() => setSharePermission(perm)}
                          >
                            <Text
                              style={[
                                styles.permPillText,
                                isSelected && styles.permPillTextActive,
                              ]}
                            >
                              Can {perm.charAt(0).toUpperCase() + perm.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Optional Expiry Date Input */}
                    <View style={styles.expiryInputRow}>
                      <Calendar size={14} color="#64748B" />
                      <TextInput
                        style={styles.expiryInput}
                        placeholder="Optional Expiration (YYYY-MM-DD)"
                        placeholderTextColor="#94A3B8"
                        value={shareExpiresAt}
                        onChangeText={setShareExpiresAt}
                      />
                    </View>

                    {/* Submit Share Button */}
                    <TouchableOpacity
                      style={styles.shareSubmitBtn}
                      onPress={handleAddShareSubmit}
                      disabled={shareSubmitting}
                      activeOpacity={0.8}
                    >
                      {shareSubmitting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.shareSubmitBtnText}>Share Note</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Who Has Access List */}
                  <View style={styles.whoHasAccessSection}>
                    <Text style={styles.sectionHeaderTitle}>Who Has Access</Text>

                    {/* Owner Row */}
                    <View style={styles.accessRow}>
                      <View style={styles.accessAvatar}>
                        <Text style={styles.accessAvatarText}>
                          {shareTargetNote?.owner_name?.[0] || 'U'}
                        </Text>
                      </View>
                      <View style={styles.accessInfo}>
                        <View style={styles.accessNameRow}>
                          <Text style={styles.accessName}>{shareTargetNote?.owner_name}</Text>
                          <View style={styles.ownerBadge}>
                            <Text style={styles.ownerBadgeText}>Owner</Text>
                          </View>
                        </View>
                        <Text style={styles.accessSubtext}>{shareTargetNote?.owner_email}</Text>
                      </View>
                      <Text style={styles.fullAccessText}>Full Access</Text>
                    </View>

                    {/* Collaborator Shares */}
                    {sharesList.length === 0 ? (
                      <View style={styles.emptySharesBox}>
                        <Text style={styles.emptySharesText}>
                          This note is private. Only you can view or edit it.
                        </Text>
                      </View>
                    ) : (
                      sharesList.map((s) => {
                        const displayName = s.user_name || `Group: ${s.group_name}`;
                        const subText = s.user_email || 'Group members';

                        return (
                          <View key={s.id} style={styles.accessRow}>
                            <View style={[styles.accessAvatar, styles.collabAvatar]}>
                              <Text style={styles.collabAvatarText}>
                                {displayName[0]?.toUpperCase() || 'C'}
                              </Text>
                            </View>
                            <View style={styles.accessInfo}>
                              <Text style={styles.accessName} numberOfLines={1}>
                                {displayName}
                              </Text>
                              <Text style={styles.accessSubtext} numberOfLines={1}>
                                {subText}
                                {s.expires_at ? ` • Exp: ${formatDate(s.expires_at)}` : ''}
                              </Text>
                            </View>
                            <View style={styles.accessRightRow}>
                              <View style={styles.permTag}>
                                <Text style={styles.permTagText}>Can {s.permission}</Text>
                              </View>
                              <TouchableOpacity
                                style={styles.revokeBtn}
                                onPress={() => handleRevokeShare(s.id, displayName)}
                              >
                                <Text style={styles.revokeBtnText}>Revoke</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                </>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => setShareModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ────────────────────────────────────────────────────────────────
          NOTE EDITOR MODAL (New Note / Edit Note with Checklist,
          Linked Items, Attachments, and Labels)
      ──────────────────────────────────────────────────────────────── */}
      <Modal
        visible={editorModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditorModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.editorModalSheet,
              EDITOR_BG_STYLES[noteColor] || styles.editorBgWhite,
            ]}
          >
            {/* Header Toolbar: Left side only show Editing, Right side only show Pin & Close */}
            <View style={styles.editorHeader}>
              <View style={styles.editorHeaderLeft}>
                <Text style={styles.editorHeaderEditingTitle}>Editing</Text>
              </View>

              <View style={styles.editorHeaderRight}>
                {/* Pin Toggle */}
                <TouchableOpacity
                  style={[
                    styles.editorPinBtn,
                    notePinned && styles.editorPinBtnActive,
                  ]}
                  onPress={() => setNotePinned(!notePinned)}
                >
                  <Pin
                    size={16}
                    color={notePinned ? '#2878C7' : '#64748B'}
                    fill={notePinned ? '#2878C7' : 'none'}
                  />
                </TouchableOpacity>

                {/* Close */}
                <TouchableOpacity
                  onPress={() => setEditorModalVisible(false)}
                  hitSlop={styles.hitSlop8}
                >
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Priority & Color Dropdown Section */}
            <View style={styles.editorDropdownsContainer}>
              <View style={styles.editorDropdownsRow}>
                {/* Priority Dropdown */}
                <View style={styles.editorDropdownCol}>
                  <Text style={styles.editorFieldLabel}>Priority</Text>
                  <TouchableOpacity
                    style={styles.editorDropdownBtn}
                    onPress={() => {
                      setShowPriorityDropdown(!showPriorityDropdown);
                      setShowColorDropdown(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.editorDropdownBtnContent}>
                      <View
                        style={[
                          styles.priorityDotBadge,
                          {
                            backgroundColor:
                              PRIORITY_OPTIONS.find((p) => p.key === notePriority)
                                ?.text || '#2563EB',
                          },
                        ]}
                      />
                      <Text style={styles.editorDropdownBtnText}>
                        {PRIORITY_OPTIONS.find((p) => p.key === notePriority)
                          ?.label || 'Medium'}
                      </Text>
                    </View>
                    <ChevronDown size={14} color="#64748B" />
                  </TouchableOpacity>

                  {showPriorityDropdown && (
                    <View style={styles.editorDropdownList}>
                      {PRIORITY_OPTIONS.map((p) => {
                        const isSelected = notePriority === p.key;
                        return (
                          <TouchableOpacity
                            key={p.key}
                            style={[
                              styles.editorDropdownItem,
                              isSelected && styles.editorDropdownItemActive,
                            ]}
                            onPress={() => {
                              setNotePriority(p.key);
                              setShowPriorityDropdown(false);
                            }}
                          >
                            <View style={styles.editorDropdownItemLeft}>
                              <View
                                style={[
                                  styles.priorityDotBadge,
                                  { backgroundColor: p.text },
                                ]}
                              />
                              <Text
                                style={[
                                  styles.editorDropdownItemText,
                                  isSelected && styles.editorDropdownItemTextActive,
                                ]}
                              >
                                {p.label}
                              </Text>
                            </View>
                            {isSelected && <Check size={14} color="#17365D" />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* Color Selection Dropdown */}
                <View style={styles.editorDropdownCol}>
                  <Text style={styles.editorFieldLabel}>Color</Text>
                  <TouchableOpacity
                    style={styles.editorDropdownBtn}
                    onPress={() => {
                      setShowColorDropdown(!showColorDropdown);
                      setShowPriorityDropdown(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.editorDropdownBtnContent}>
                      <View
                        style={[
                          styles.colorDotBadge,
                          { backgroundColor: noteColor },
                        ]}
                      />
                      <Text style={styles.editorDropdownBtnText} numberOfLines={1}>
                        {COLOR_OPTIONS.find((c) => c.hex === noteColor)?.label ||
                          'White'}
                      </Text>
                    </View>
                    <ChevronDown size={14} color="#64748B" />
                  </TouchableOpacity>

                  {showColorDropdown && (
                    <View style={styles.editorDropdownList}>
                      {COLOR_OPTIONS.map((c) => {
                        const isSelected = noteColor === c.hex;
                        return (
                          <TouchableOpacity
                            key={c.hex}
                            style={[
                              styles.editorDropdownItem,
                              isSelected && styles.editorDropdownItemActive,
                            ]}
                            onPress={() => {
                              setNoteColor(c.hex);
                              setShowColorDropdown(false);
                            }}
                          >
                            <View style={styles.editorDropdownItemLeft}>
                              <View
                                style={[
                                  styles.colorDotBadge,
                                  { backgroundColor: c.hex },
                                ]}
                              />
                              <Text
                                style={[
                                  styles.editorDropdownItemText,
                                  isSelected && styles.editorDropdownItemTextActive,
                                ]}
                              >
                                {c.label}
                              </Text>
                            </View>
                            {isSelected && <Check size={14} color="#17365D" />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Scrollable Editor Body */}
            <ScrollView
              style={styles.editorScroll}
              contentContainerStyle={styles.editorScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {editorLoading ? (
                <View style={styles.editorLoadingBox}>
                  <ActivityIndicator size="small" color="#17365D" />
                  <Text style={styles.editorLoadingText}>Loading note content...</Text>
                </View>
              ) : (
                <>
                  {/* Title Input */}
                  <TextInput
                    style={styles.titleInput}
                    placeholder="Note title..."
                    placeholderTextColor="#94A3B8"
                    value={noteTitle}
                    onChangeText={setNoteTitle}
                  />

                  {/* Body Content Input */}
                  <TextInput
                    style={styles.contentInput}
                    placeholder="Write your note with actionable thoughts..."
                    placeholderTextColor="#94A3B8"
                    value={noteContent}
                    onChangeText={setNoteContent}
                    multiline
                    textAlignVertical="top"
                  />

                  {/* ─── 1. Actionable Checklist Section ───────────── */}
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionCardHeader}>
                      <View style={styles.sectionTitleRow}>
                        <SquareCheck size={16} color="#15803D" />
                        <Text style={styles.sectionCardTitle}>Actionable Checklist</Text>
                      </View>
                      <Text style={styles.sectionCounterText}>
                        {checklists.filter((c) => c.is_completed).length} /{' '}
                        {checklists.length} done
                      </Text>
                    </View>

                    {/* Checklist Items */}
                    {checklists.map((item, idx) => (
                      <View key={idx} style={styles.checklistItemRow}>
                        <TouchableOpacity
                          onPress={() => handleToggleChecklist(idx)}
                          style={styles.checkboxTouch}
                        >
                          {item.is_completed ? (
                            <SquareCheck size={18} color="#2563EB" />
                          ) : (
                            <Square size={18} color="#94A3B8" />
                          )}
                        </TouchableOpacity>
                        <Text
                          style={[
                            styles.checklistText,
                            item.is_completed && styles.checklistTextCompleted,
                          ]}
                        >
                          {item.item_text}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleDeleteChecklist(idx)}
                          hitSlop={styles.hitSlop8}
                        >
                          <X size={14} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>
                    ))}

                    {/* Add Item Input */}
                    <View style={styles.addChecklistRow}>
                      <TextInput
                        style={styles.addChecklistInput}
                        placeholder="Add an actionable todo item..."
                        placeholderTextColor="#94A3B8"
                        value={newChecklistText}
                        onChangeText={setNewChecklistText}
                        onSubmitEditing={handleAddChecklist}
                        returnKeyType="done"
                      />
                      <TouchableOpacity
                        style={styles.addChecklistBtn}
                        onPress={handleAddChecklist}
                      >
                        <Plus size={14} color="#17365D" />
                        <Text style={styles.addChecklistBtnText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* ─── 2. Linked Work Items Section ───────────────── */}
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionCardHeader}>
                      <View style={styles.sectionTitleRow}>
                        <Link2 size={16} color="#2563EB" />
                        <Text style={styles.sectionCardTitle}>Linked Work Items</Text>
                      </View>
                      <TouchableOpacity onPress={handleOpenLinkPicker}>
                        <Text style={styles.sectionActionText}>+ Link Task / Project</Text>
                      </TouchableOpacity>
                    </View>

                    {links.length === 0 ? (
                      <Text style={styles.emptySectionText}>
                        No tasks or projects linked to this note yet.
                      </Text>
                    ) : (
                      <View style={styles.linksChipWrap}>
                        {links.map((linkItem, idx) => (
                          <View key={idx} style={styles.linkChip}>
                            <View style={styles.linkChipTypeTag}>
                              <Text style={styles.linkChipTypeTagText}>
                                {linkItem.entity_type}
                              </Text>
                            </View>
                            <Text style={styles.linkChipTitle} numberOfLines={1}>
                              {linkItem.title || `#${linkItem.entity_id}`}
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleDeleteEntityLink(linkItem, idx)}
                              hitSlop={styles.hitSlop8}
                            >
                              <X size={12} color="#2563EB" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Link Picker Sub-drawer */}
                    {linkPickerOpen && (
                      <View style={styles.linkPickerSubdrawer}>
                        {/* Task / Project Switcher */}
                        <View style={styles.targetTypeSwitcher}>
                          <TouchableOpacity
                            style={[
                              styles.targetTypeBtn,
                              selectedEntityType === 'task' && styles.targetTypeBtnActive,
                            ]}
                            onPress={() => {
                              setSelectedEntityType('task');
                              if (linkableEntities.tasks.length > 0) {
                                setSelectedEntityId(linkableEntities.tasks[0].id);
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.targetTypeText,
                                selectedEntityType === 'task' && styles.targetTypeTextActive,
                              ]}
                            >
                              Task
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.targetTypeBtn,
                              selectedEntityType === 'project' && styles.targetTypeBtnActive,
                            ]}
                            onPress={() => {
                              setSelectedEntityType('project');
                              if (linkableEntities.projects.length > 0) {
                                setSelectedEntityId(linkableEntities.projects[0].id);
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.targetTypeText,
                                selectedEntityType === 'project' && styles.targetTypeTextActive,
                              ]}
                            >
                              Project
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Entity Selector Dropdown */}
                        <TouchableOpacity
                          style={styles.selectDropdownBtn}
                          onPress={() => setShowEntityDropdown(!showEntityDropdown)}
                        >
                          <Text style={styles.selectDropdownBtnText} numberOfLines={1}>
                            {selectedEntityType === 'task'
                              ? linkableEntities.tasks.find(
                                  (t) => String(t.id) === String(selectedEntityId)
                                )?.title || 'Select a task...'
                              : linkableEntities.projects.find(
                                  (p) => String(p.id) === String(selectedEntityId)
                                )?.title || 'Select a project...'}
                          </Text>
                          <ChevronDown size={14} color="#64748B" />
                        </TouchableOpacity>

                        {showEntityDropdown && (
                          <View style={styles.dropdownList}>
                            {selectedEntityType === 'task'
                              ? linkableEntities.tasks.map((t) => (
                                  <TouchableOpacity
                                    key={t.id}
                                    style={[
                                      styles.dropdownItem,
                                      String(selectedEntityId) === String(t.id) &&
                                        styles.dropdownItemActive,
                                    ]}
                                    onPress={() => {
                                      setSelectedEntityId(t.id);
                                      setShowEntityDropdown(false);
                                    }}
                                  >
                                    <Text style={styles.dropdownItemText}>
                                      [{t.task_code}] {t.title}
                                    </Text>
                                  </TouchableOpacity>
                                ))
                              : linkableEntities.projects.map((p) => (
                                  <TouchableOpacity
                                    key={p.id}
                                    style={[
                                      styles.dropdownItem,
                                      String(selectedEntityId) === String(p.id) &&
                                        styles.dropdownItemActive,
                                    ]}
                                    onPress={() => {
                                      setSelectedEntityId(p.id);
                                      setShowEntityDropdown(false);
                                    }}
                                  >
                                    <Text style={styles.dropdownItemText}>
                                      [{p.project_code || 'PRJ'}] {p.title}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                          </View>
                        )}

                        <View style={styles.linkPickerActionsRow}>
                          <TouchableOpacity
                            style={styles.attachEntityBtn}
                            onPress={handleAttachEntityLink}
                          >
                            <Text style={styles.attachEntityBtnText}>Attach</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.cancelEntityBtn}
                            onPress={() => setLinkPickerOpen(false)}
                          >
                            <Text style={styles.cancelEntityBtnText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* ─── 3. Attachments & Document Section ───────────── */}
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionCardHeader}>
                      <View style={styles.sectionTitleRow}>
                        <Paperclip size={16} color="#64748B" />
                        <Text style={styles.sectionCardTitle}>Attachments & Documents</Text>
                      </View>
                      <TouchableOpacity
                        onPress={handlePickDocument}
                        disabled={uploadingAttachment}
                      >
                        <Text style={styles.sectionActionText}>
                          {uploadingAttachment ? 'Uploading...' : '+ Upload File'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {attachments.length === 0 && localPendingAttachments.length === 0 ? (
                      <Text style={styles.emptySectionText}>
                        No files attached to this note.
                      </Text>
                    ) : (
                      <View style={styles.attachmentsList}>
                        {/* Server Attachments */}
                        {attachments.map((att) => (
                          <View key={att.id} style={styles.attachmentItemRow}>
                            <View style={styles.attachmentItemLeft}>
                              <Paperclip size={14} color="#2878C7" />
                              <Text style={styles.attachmentName} numberOfLines={1}>
                                {att.file_name}
                              </Text>
                            </View>
                            <View style={styles.attachmentItemRight}>
                              <Text style={styles.attachmentSize}>
                                {(Number(att.file_size) / 1024).toFixed(1)} KB
                              </Text>
                              <TouchableOpacity
                                onPress={() => handleDeleteAttachment(att.id)}
                                hitSlop={styles.hitSlop8}
                              >
                                <X size={14} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}

                        {/* Local Pending Attachments (for new note) */}
                        {localPendingAttachments.map((localAtt, idx) => (
                          <View key={`local-${idx}`} style={styles.attachmentItemRow}>
                            <View style={styles.attachmentItemLeft}>
                              <Paperclip size={14} color="#15803D" />
                              <Text style={styles.attachmentName} numberOfLines={1}>
                                {localAtt.name} (Pending Save)
                              </Text>
                            </View>
                            <View style={styles.attachmentItemRight}>
                              <Text style={styles.attachmentSize}>
                                {(Number(localAtt.size) / 1024).toFixed(1)} KB
                              </Text>
                              <TouchableOpacity
                                onPress={() => handleDeleteLocalPendingAttachment(idx)}
                                hitSlop={styles.hitSlop8}
                              >
                                <X size={14} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* ─── 4. Labels Section ───────────────────────────── */}
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionCardHeader}>
                      <View style={styles.sectionTitleRow}>
                        <Tag size={16} color="#7C3AED" />
                        <Text style={styles.sectionCardTitle}>Labels & Tags</Text>
                      </View>
                    </View>

                    <View style={styles.labelsChipWrap}>
                      {labels.map((lbl, idx) => (
                        <View key={idx} style={styles.labelChip}>
                          <Text style={styles.labelChipText}>#{lbl}</Text>
                          <TouchableOpacity
                            onPress={() => handleRemoveLabel(lbl)}
                            hitSlop={styles.hitSlop8}
                          >
                            <X size={12} color="#475569" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>

                    <View style={styles.addLabelRow}>
                      <TextInput
                        style={styles.addLabelInput}
                        placeholder="Add tag and press Enter or Add..."
                        placeholderTextColor="#94A3B8"
                        value={labelInput}
                        onChangeText={setLabelInput}
                        onSubmitEditing={handleAddLabel}
                        returnKeyType="done"
                      />
                      <TouchableOpacity
                        style={styles.addLabelBtn}
                        onPress={handleAddLabel}
                      >
                        <Plus size={14} color="#17365D" />
                        <Text style={styles.addLabelBtnText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>

            {/* Footer Buttons */}
            <View style={styles.editorFooter}>
              <TouchableOpacity
                style={styles.editorCancelBtn}
                onPress={() => setEditorModalVisible(false)}
                disabled={savingNote}
              >
                <Text style={styles.editorCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editorSaveBtn}
                onPress={handleSaveNote}
                disabled={savingNote || editorLoading}
                activeOpacity={0.8}
              >
                {savingNote ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={16} color="#FFFFFF" />
                    <Text style={styles.editorSaveBtnText}>
                      {editingNoteId ? 'Save Changes' : 'Create Note'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F3F6FD',
  },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabButtonActive: {
    // active tab
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#17365D',
    fontWeight: '700',
  },
  tabActiveIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '15%',
    right: '15%',
    height: 3,
    backgroundColor: '#17365D',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#17212F',
    paddingVertical: 0,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17212F',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#17365D',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyCreateBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 32,
    gap: 12,
  },
  noteCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  noteCardPinned: {
    borderColor: '#2878C7',
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  shareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  shareBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4338CA',
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  privateBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
  },
  sharedWithMeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 120,
  },
  sharedWithMeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0369A1',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(241, 245, 249, 0.8)',
  },
  iconButtonPinned: {
    backgroundColor: '#EFF6FF',
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#17212F',
    marginBottom: 4,
    lineHeight: 20,
  },
  noteSnippet: {
    fontSize: 12,
    color: '#5B6573',
    lineHeight: 17,
    marginBottom: 10,
  },
  cardLabelsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 8,
  },
  cardLabelPill: {
    backgroundColor: 'rgba(226, 232, 240, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
  },
  cardLabelMore: {
    fontSize: 10,
    color: '#94A3B8',
    alignSelf: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.7)',
    paddingTop: 8,
    marginTop: 2,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checklistBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checklistBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#15803D',
  },
  metricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metricBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dateBadgeText: {
    fontSize: 10.5,
    color: '#94A3B8',
  },
  pinnedPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pinnedPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#2878C7',
  },
  hitSlop8: {
    top: 8,
    bottom: 8,
    left: 8,
    right: 8,
  },
  hitSlop10: {
    top: 10,
    bottom: 10,
    left: 10,
    right: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  shareModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  shareTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  shareHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareHeaderTextCol: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#17212F',
  },
  shareNoteSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  modalScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  shareModalLoading: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  shareModalLoadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  inviteSection: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#64748B',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  targetTypeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 2,
    marginBottom: 10,
  },
  targetTypeBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  targetTypeBtnActive: {
    backgroundColor: '#17365D',
  },
  targetTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  targetTypeTextActive: {
    color: '#FFFFFF',
  },
  selectDropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  selectDropdownBtnText: {
    fontSize: 12.5,
    color: '#17212F',
    fontWeight: '500',
    flex: 1,
  },
  dropdownList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    marginBottom: 10,
    maxHeight: 160,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemActive: {
    backgroundColor: '#EFF6FF',
  },
  dropdownItemText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#17212F',
  },
  dropdownItemSubText: {
    fontSize: 11,
    color: '#64748B',
  },
  permissionRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  permPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  permPillActive: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  permPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  permPillTextActive: {
    color: '#FFFFFF',
  },
  expiryInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 12,
  },
  expiryInput: {
    flex: 1,
    fontSize: 12,
    color: '#17212F',
    paddingVertical: 0,
  },
  shareSubmitBtn: {
    backgroundColor: '#2878C7',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareSubmitBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  whoHasAccessSection: {
    marginBottom: 16,
  },
  accessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  accessAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#17365D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  accessAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  collabAvatar: {
    backgroundColor: '#E2E8F0',
  },
  collabAvatarText: {
    color: '#334155',
  },
  accessInfo: {
    flex: 1,
  },
  accessNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accessName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#17212F',
  },
  ownerBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  ownerBadgeText: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
  },
  accessSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  fullAccessText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  accessRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  permTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  permTagText: {
    fontSize: 10.5,
    color: '#2878C7',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  revokeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#FEF2F2',
    borderRadius: 4,
  },
  revokeBtnText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#DC2626',
  },
  emptySharesBox: {
    padding: 16,
    alignItems: 'center',
  },
  emptySharesText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  doneBtn: {
    backgroundColor: '#17365D',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  editorModalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    paddingBottom: 20,
  },
  editorBgWhite: {
    backgroundColor: '#FFFFFF',
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.8)',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  editorHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  editorHeaderEditingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  editorDropdownsContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.8)',
    zIndex: 20,
  },
  editorDropdownsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  editorDropdownCol: {
    flex: 1,
    position: 'relative',
  },
  editorFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  editorDropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  editorDropdownBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  editorDropdownBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#17212F',
  },
  priorityDotBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  colorDotBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  editorDropdownList: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    zIndex: 999,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  editorDropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  editorDropdownItemActive: {
    backgroundColor: '#F8FAFC',
  },
  editorDropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editorDropdownItemText: {
    fontSize: 12,
    color: '#334155',
  },
  editorDropdownItemTextActive: {
    fontWeight: '700',
    color: '#17365D',
  },
  editorHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editorPinBtn: {
    padding: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  editorPinBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  editorScroll: {
    paddingHorizontal: 16,
  },
  editorScrollContent: {
    paddingVertical: 14,
    gap: 12,
  },
  editorLoadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  editorLoadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  titleInput: {
    fontSize: 18,
    fontWeight: '700',
    color: '#17212F',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.8)',
    paddingBottom: 6,
    marginBottom: 4,
  },
  contentInput: {
    fontSize: 13.5,
    color: '#17212F',
    minHeight: 90,
    lineHeight: 19,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionCardTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#17365D',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionCounterText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  sectionActionText: {
    fontSize: 11.5,
    color: '#2878C7',
    fontWeight: '700',
  },
  emptySectionText: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  checklistItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  checkboxTouch: {
    padding: 2,
  },
  checklistText: {
    flex: 1,
    fontSize: 12.5,
    color: '#17212F',
  },
  checklistTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  addChecklistRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  addChecklistInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#17212F',
  },
  addChecklistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addChecklistBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#17365D',
  },
  linksChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  linkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  linkChipTypeTag: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  linkChipTypeTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1D4ED8',
    textTransform: 'uppercase',
  },
  linkChipTitle: {
    fontSize: 11.5,
    color: '#1E40AF',
    flexShrink: 1,
  },
  linkPickerSubdrawer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  linkPickerActionsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  attachEntityBtn: {
    backgroundColor: '#17365D',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  attachEntityBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelEntityBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cancelEntityBtnText: {
    fontSize: 12,
    color: '#64748B',
  },
  attachmentsList: {
    gap: 6,
    marginTop: 4,
  },
  attachmentItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  attachmentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  attachmentName: {
    fontSize: 12,
    color: '#2878C7',
    fontWeight: '500',
    flexShrink: 1,
  },
  attachmentItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attachmentSize: {
    fontSize: 10.5,
    color: '#94A3B8',
  },
  labelsChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  labelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  labelChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6D28D9',
  },
  addLabelRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  addLabelInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#17212F',
  },
  addLabelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addLabelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#17365D',
  },
  editorFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.8)',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  editorCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  editorCancelBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  editorSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#17365D',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  editorSaveBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
