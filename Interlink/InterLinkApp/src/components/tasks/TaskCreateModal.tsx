import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import {
  Plus,
  X,
  Check,
  ChevronDown,
  Calendar,
  Clock,
  Trash2,
  Folder,
  Flag,
  User,
  Tag,
} from 'lucide-react-native';
import {
  createTaskApi,
  fetchTaskMetadataApi,
  fetchTasks,
  TaskMetadata,
  TaskItem,
} from '../../api/taskApi';

export interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  defaultProjectId?: number | null;
  existingTasks?: TaskItem[];
}

const getColorStyle = (color?: string) => (color ? { color } : undefined);
const getBgColorStyle = (backgroundColor?: string) =>
  backgroundColor ? { backgroundColor } : undefined;
const getLabelChipStyle = (isSelected: boolean, color: string) => ({
  borderColor: isSelected ? color : '#E2E8F0',
  backgroundColor: isSelected ? `${color}20` : '#F8FAFC',
});

export const TaskCreateModal: React.FC<TaskCreateModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  defaultProjectId = null,
  existingTasks: passedExistingTasks,
}) => {
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<number | null>(defaultProjectId);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [status, setStatus] = useState<string>('todo');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<number[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [blockedByIds, setBlockedByIds] = useState<number[]>([]);
  const [checklists, setChecklists] = useState<string[]>(['']);

  // Metadata & Existing Tasks State
  const [metadata, setMetadata] = useState<TaskMetadata>({
    projects: [],
    users: [],
    labels: [],
    statuses: ['todo', 'in_progress', 'backlog'],
    priorities: ['low', 'medium', 'high', 'urgent'],
  });
  const [availableTasks, setAvailableTasks] = useState<TaskItem[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // Submitting & Dirty Tracking
  const [submitting, setSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Picker Modals
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);

  // Load Metadata & Tasks on Open
  const loadMetadataAndTasks = useCallback(async () => {
    try {
      setLoadingMetadata(true);
      const metaRes = await fetchTaskMetadataApi();
      if (metaRes.success && metaRes.data) {
        setMetadata(metaRes.data);
      }

      if (passedExistingTasks && passedExistingTasks.length > 0) {
        setAvailableTasks(passedExistingTasks);
      } else {
        const tasksRes = await fetchTasks();
        if (tasksRes.success && Array.isArray(tasksRes.data)) {
          setAvailableTasks(tasksRes.data);
        }
      }
    } catch (err) {
      console.log('Error loading task metadata:', err);
    } finally {
      setLoadingMetadata(false);
    }
  }, [passedExistingTasks]);

  useEffect(() => {
    if (isOpen) {
      // Reset form
      setTitle('');
      setDescription('');
      setProjectId(defaultProjectId ?? null);
      setPriority('medium');
      setStatus('todo');
      setStartDate('');
      setDueDate('');
      setEstimatedHours('');
      setSelectedAssignees([]);
      setSelectedLabels([]);
      setBlockedByIds([]);
      setChecklists(['']);
      setIsDirty(false);
      setProjectPickerOpen(false);
      setPriorityPickerOpen(false);
      setStatusPickerOpen(false);

      loadMetadataAndTasks();
    }
  }, [isOpen, defaultProjectId, loadMetadataAndTasks]);

  const handleClose = () => {
    if (isDirty) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onClose },
        ]
      );
    } else {
      onClose();
    }
  };

  const handleAddChecklist = () => {
    setChecklists([...checklists, '']);
    setIsDirty(true);
  };

  const handleChecklistChange = (index: number, val: string) => {
    const next = [...checklists];
    next[index] = val;
    setChecklists(next);
    setIsDirty(true);
  };

  const handleRemoveChecklist = (index: number) => {
    setChecklists(checklists.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  const handleToggleAssignee = (userId: number) => {
    if (selectedAssignees.includes(userId)) {
      setSelectedAssignees(selectedAssignees.filter((id) => id !== userId));
    } else {
      setSelectedAssignees([...selectedAssignees, userId]);
    }
    setIsDirty(true);
  };

  const handleToggleLabel = (labelId: number) => {
    if (selectedLabels.includes(labelId)) {
      setSelectedLabels(selectedLabels.filter((id) => id !== labelId));
    } else {
      setSelectedLabels([...selectedLabels, labelId]);
    }
    setIsDirty(true);
  };

  const handleToggleBlockedBy = (taskId: number) => {
    if (blockedByIds.includes(taskId)) {
      setBlockedByIds(blockedByIds.filter((id) => id !== taskId));
    } else {
      setBlockedByIds([...blockedByIds, taskId]);
    }
    setIsDirty(true);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Required Field', 'Please enter a task title.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        project_id: projectId ? Number(projectId) : null,
        priority,
        status,
        start_date: startDate.trim() ? `${startDate.trim()} 09:00:00` : null,
        due_date: dueDate.trim() ? `${dueDate.trim()} 18:00:00` : null,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : 0,
        assignees: selectedAssignees,
        labels: selectedLabels,
        checklists: checklists.filter((c) => c.trim().length > 0),
        blocked_by_ids: blockedByIds,
      };

      const res = await createTaskApi(payload);
      if (res.success) {
        setIsDirty(false);
        Alert.alert(
          'Task Created',
          `Task ${res.data?.task_code || 'created'} successfully!`,
          [
            {
              text: 'OK',
              onPress: () => {
                if (onCreated) onCreated();
                onClose();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', res.message || 'Failed to create task.');
      }
    } catch (err: any) {
      console.error('Create task error:', err);
      Alert.alert('Error', err?.message || 'Error creating task.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProjectObj = metadata.projects?.find((p) => p.id === projectId);

  const getPriorityConfig = (p: string) => {
    switch (p.toLowerCase()) {
      case 'urgent':
        return { label: 'Urgent', bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' };
      case 'high':
        return { label: 'High', bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' };
      case 'medium':
        return { label: 'Medium', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
      case 'low':
        return { label: 'Low', bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0' };
      default:
        return { label: p, bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' };
    }
  };

  const getStatusLabel = (s: string) => {
    switch (s.toLowerCase()) {
      case 'todo':
        return 'To Do';
      case 'in_progress':
        return 'In Progress';
      case 'backlog':
        return 'Backlog';
      case 'in_review':
        return 'In Review';
      case 'done':
        return 'Completed';
      default:
        return s;
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.drawerCard}>
          {/* Header */}
          <View style={styles.drawerHeader}>
            <View style={styles.headerTitleGroup}>
              <View style={styles.headerIconCircle}>
                <Plus size={16} color="#93C5FD" strokeWidth={2.5} />
              </View>
              <View>
                <Text style={styles.drawerTitle}>Create Task</Text>
                <Text style={styles.drawerSubtitle}>
                  Screen ID: TASK-03 • Enterprise Workspace
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              accessibilityLabel="Close Drawer"
            >
              <X size={20} color="#CBD5E1" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {loadingMetadata ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#17365D" />
              <Text style={styles.loadingText}>Loading task attributes...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* 1. Task Title */}
              <View style={styles.cardSection}>
                <Text style={styles.fieldLabel}>
                  TASK TITLE <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Implement Real-Time Gantt Dependency Cascade"
                  placeholderTextColor="#94A3B8"
                  value={title}
                  onChangeText={(val) => {
                    setTitle(val);
                    setIsDirty(true);
                  }}
                />
              </View>

              {/* 2. Description & Specifications */}
              <View style={styles.cardSection}>
                <Text style={styles.fieldLabel}>DESCRIPTION & SPECIFICATIONS</Text>
                <TextInput
                  style={[styles.textInput, styles.textAreaInput]}
                  placeholder="Detailed technical context, acceptance criteria, or execution notes..."
                  placeholderTextColor="#94A3B8"
                  value={description}
                  onChangeText={(val) => {
                    setDescription(val);
                    setIsDirty(true);
                  }}
                  multiline
                  numberOfLines={4}
                />
              </View>

              {/* 3. Core Attributes (Project, Priority, Start Date, Due Date, Hours, Status) */}
              <View style={styles.cardSection}>
                {/* Project Selector Dropdown */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>PROJECT</Text>
                  <TouchableOpacity
                    style={styles.dropdownBtn}
                    onPress={() => setProjectPickerOpen(true)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.dropdownValueRow}>
                      <Folder size={15} color="#2878C7" />
                      <Text style={styles.dropdownValueText} numberOfLines={1}>
                        {selectedProjectObj
                          ? `${selectedProjectObj.code}: ${selectedProjectObj.name}`
                          : 'No Project (Standalone)'}
                      </Text>
                    </View>
                    <ChevronDown size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Priority Selector Dropdown */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>PRIORITY LEVEL</Text>
                  <TouchableOpacity
                    style={styles.dropdownBtn}
                    onPress={() => setPriorityPickerOpen(true)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.dropdownValueRow}>
                      <Flag size={15} color={getPriorityConfig(priority).text} />
                      <Text
                        style={[
                          styles.dropdownValueText,
                          styles.boldText,
                          getColorStyle(getPriorityConfig(priority).text),
                        ]}
                      >
                        {getPriorityConfig(priority).label}
                      </Text>
                    </View>
                    <ChevronDown size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Start Date & Due Date in Row */}
                <View style={styles.rowTwoCols}>
                  <View style={styles.colHalf}>
                    <Text style={styles.fieldLabel}>START DATE</Text>
                    <View style={styles.inputWithIcon}>
                      <Calendar size={14} color="#64748B" />
                      <TextInput
                        style={styles.dateTextInput}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#94A3B8"
                        value={startDate}
                        onChangeText={(val) => {
                          setStartDate(val);
                          setIsDirty(true);
                        }}
                      />
                    </View>
                  </View>

                  <View style={styles.colHalf}>
                    <Text style={styles.fieldLabel}>DUE DATE</Text>
                    <View style={styles.inputWithIcon}>
                      <Calendar size={14} color="#64748B" />
                      <TextInput
                        style={styles.dateTextInput}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#94A3B8"
                        value={dueDate}
                        onChangeText={(val) => {
                          setDueDate(val);
                          setIsDirty(true);
                        }}
                      />
                    </View>
                  </View>
                </View>

                {/* Estimated Hours & Status in Row */}
                <View style={styles.rowTwoCols}>
                  <View style={styles.colHalf}>
                    <Text style={styles.fieldLabel}>ESTIMATED HOURS</Text>
                    <View style={styles.inputWithIcon}>
                      <Clock size={14} color="#64748B" />
                      <TextInput
                        style={styles.dateTextInput}
                        placeholder="e.g. 16.0"
                        placeholderTextColor="#94A3B8"
                        keyboardType="decimal-pad"
                        value={estimatedHours}
                        onChangeText={(val) => {
                          setEstimatedHours(val);
                          setIsDirty(true);
                        }}
                      />
                    </View>
                  </View>

                  <View style={styles.colHalf}>
                    <Text style={styles.fieldLabel}>INITIAL STATUS</Text>
                    <TouchableOpacity
                      style={styles.dropdownBtnCompact}
                      onPress={() => setStatusPickerOpen(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.dropdownValueText} numberOfLines={1}>
                        {getStatusLabel(status)}
                      </Text>
                      <ChevronDown size={14} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* 4. Assignees Selector */}
              <View style={styles.cardSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.fieldLabel}>
                    ASSIGNEES ({selectedAssignees.length} SELECTED)
                  </Text>
                  <User size={14} color="#64748B" />
                </View>
                {metadata.users?.length === 0 ? (
                  <Text style={styles.emptyNote}>No users found in organization.</Text>
                ) : (
                  <View style={styles.chipsContainer}>
                    {metadata.users?.map((u) => {
                      const isSelected = selectedAssignees.includes(u.id);
                      return (
                        <TouchableOpacity
                          key={u.id}
                          style={[
                            styles.userChip,
                            isSelected && styles.userChipSelected,
                          ]}
                          onPress={() => handleToggleAssignee(u.id)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.userChipAvatar,
                              isSelected && styles.userChipAvatarSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.userChipAvatarText,
                                isSelected && styles.userChipAvatarTextSelected,
                              ]}
                            >
                              {(u.name || u.username || 'U')[0].toUpperCase()}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.userChipName,
                              isSelected && styles.userChipNameSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {u.name || u.username}
                          </Text>
                          {isSelected && (
                            <Check size={12} color="#FFFFFF" strokeWidth={3} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* 5. Universal Labels */}
              <View style={styles.cardSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.fieldLabel}>UNIVERSAL LABELS</Text>
                  <Tag size={14} color="#64748B" />
                </View>
                {metadata.labels?.length === 0 ? (
                  <Text style={styles.emptyNote}>No workspace labels defined.</Text>
                ) : (
                  <View style={styles.chipsContainer}>
                    {metadata.labels?.map((lbl) => {
                      const isSelected = selectedLabels.includes(lbl.id);
                      const color = lbl.color || '#2878C7';
                      return (
                        <TouchableOpacity
                          key={lbl.id}
                          style={[
                            styles.labelChip,
                            getLabelChipStyle(isSelected, color),
                          ]}
                          onPress={() => handleToggleLabel(lbl.id)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.labelChipText,
                              isSelected && styles.boldText,
                              getColorStyle(isSelected ? color : '#475569'),
                            ]}
                          >
                            #{lbl.name}
                          </Text>
                          {isSelected && (
                            <Check size={12} color={color} strokeWidth={3} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* 6. Task Dependencies & Blockers */}
              <View style={styles.cardSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.fieldLabel}>TASK DEPENDENCIES & BLOCKERS</Text>
                  <View style={styles.badgeFs}>
                    <Text style={styles.badgeFsText}>Finish-to-Start (FS)</Text>
                  </View>
                </View>
                <Text style={styles.dependencyHint}>
                  Select prerequisite tasks that must be completed before this task:
                </Text>

                {availableTasks.length === 0 ? (
                  <Text style={styles.emptyNote}>
                    No existing tasks available to link as blockers.
                  </Text>
                ) : (
                  <View style={styles.dependenciesList}>
                    {availableTasks.slice(0, 15).map((t) => {
                      const isBlocked = blockedByIds.includes(t.id);
                      return (
                        <TouchableOpacity
                          key={t.id}
                          style={[
                            styles.dependencyItem,
                            isBlocked && styles.dependencyItemSelected,
                          ]}
                          onPress={() => handleToggleBlockedBy(t.id)}
                          activeOpacity={0.75}
                        >
                          <View style={styles.dependencyLeft}>
                            <View
                              style={[
                                styles.checkboxSquare,
                                isBlocked && styles.checkboxSquareChecked,
                              ]}
                            >
                              {isBlocked && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                            </View>
                            <Text style={styles.dependencyCode}>
                              #{t.task_code || `TSK-${t.id}`}
                            </Text>
                            <Text style={styles.dependencyTitle} numberOfLines={1}>
                              {t.title}
                            </Text>
                          </View>
                          <View style={styles.dependencyStatusPill}>
                            <Text style={styles.dependencyStatusText}>{t.status}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* 7. Checklists / Action Items */}
              <View style={styles.cardSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.fieldLabel}>CHECKLISTS / ACTION ITEMS</Text>
                  <TouchableOpacity
                    style={styles.addChecklistBtn}
                    onPress={handleAddChecklist}
                    activeOpacity={0.7}
                  >
                    <Plus size={13} color="#2878C7" strokeWidth={2.5} />
                    <Text style={styles.addChecklistText}>Add Item</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.checklistsList}>
                  {checklists.map((c, idx) => (
                    <View key={idx} style={styles.checklistItemRow}>
                      <Text style={styles.checklistIndex}>{idx + 1}.</Text>
                      <TextInput
                        style={styles.checklistInput}
                        placeholder={`Checklist item ${idx + 1}...`}
                        placeholderTextColor="#94A3B8"
                        value={c}
                        onChangeText={(val) => handleChecklistChange(idx, val)}
                      />
                      {checklists.length > 1 && (
                        <TouchableOpacity
                          onPress={() => handleRemoveChecklist(idx)}
                          style={styles.removeChecklistBtn}
                          activeOpacity={0.7}
                        >
                          <Trash2 size={14} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          )}

          {/* Sticky Footer */}
          <View style={styles.drawerFooter}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleClose}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <View style={styles.submittingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Creating...</Text>
                </View>
              ) : (
                <View style={styles.submittingRow}>
                  <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.submitBtnText}>Create Task</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── PROJECT PICKER MODAL ── */}
        <Modal
          visible={projectPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setProjectPickerOpen(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setProjectPickerOpen(false)}
          >
            <View style={styles.pickerModalCard}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Project</Text>
                <TouchableOpacity onPress={() => setProjectPickerOpen(false)}>
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    projectId === null && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setProjectId(null);
                    setIsDirty(true);
                    setProjectPickerOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      projectId === null && styles.pickerItemTextSelected,
                    ]}
                  >
                    No Project (Standalone)
                  </Text>
                  {projectId === null && <Check size={16} color="#2878C7" />}
                </TouchableOpacity>

                {metadata.projects?.map((p) => {
                  const isSelected = projectId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.pickerItem,
                        isSelected && styles.pickerItemSelected,
                      ]}
                      onPress={() => {
                        setProjectId(p.id);
                        setIsDirty(true);
                        setProjectPickerOpen(false);
                      }}
                    >
                      <View>
                        <Text
                          style={[
                            styles.pickerItemText,
                            isSelected && styles.pickerItemTextSelected,
                          ]}
                        >
                          {p.code}: {p.name}
                        </Text>
                        <Text style={styles.pickerItemSubtext}>Status: {p.status}</Text>
                      </View>
                      {isSelected && <Check size={16} color="#2878C7" />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── PRIORITY PICKER MODAL ── */}
        <Modal
          visible={priorityPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setPriorityPickerOpen(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setPriorityPickerOpen(false)}
          >
            <View style={styles.pickerModalCard}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Priority Level</Text>
                <TouchableOpacity onPress={() => setPriorityPickerOpen(false)}>
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>
              {(['low', 'medium', 'high', 'urgent'] as const).map((p) => {
                const isSelected = priority === p;
                const cfg = getPriorityConfig(p);
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.pickerItem,
                      isSelected && styles.pickerItemSelected,
                    ]}
                    onPress={() => {
                      setPriority(p);
                      setIsDirty(true);
                      setPriorityPickerOpen(false);
                    }}
                  >
                    <View style={styles.priorityPickerRow}>
                      <View
                        style={[
                          styles.priorityDot,
                          getBgColorStyle(cfg.text),
                        ]}
                      />
                      <Text
                        style={[
                          styles.pickerItemText,
                          styles.boldText,
                          getColorStyle(cfg.text),
                        ]}
                      >
                        {cfg.label}
                      </Text>
                    </View>
                    {isSelected && <Check size={16} color="#2878C7" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── STATUS PICKER MODAL ── */}
        <Modal
          visible={statusPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setStatusPickerOpen(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setStatusPickerOpen(false)}
          >
            <View style={styles.pickerModalCard}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Initial Status</Text>
                <TouchableOpacity onPress={() => setStatusPickerOpen(false)}>
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>
              {(['todo', 'in_progress', 'backlog', 'in_review', 'done'] as const).map((s) => {
                const isSelected = status === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.pickerItem,
                      isSelected && styles.pickerItemSelected,
                    ]}
                    onPress={() => {
                      setStatus(s);
                      setIsDirty(true);
                      setStatusPickerOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        isSelected && styles.pickerItemTextSelected,
                      ]}
                    >
                      {getStatusLabel(s)}
                    </Text>
                    {isSelected && <Check size={16} color="#2878C7" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  drawerCard: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    height: '92%',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: { elevation: 10 },
    }),
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#17365D',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  drawerSubtitle: {
    fontSize: 10,
    color: '#93C5FD',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    padding: 40,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 24,
  },
  cardSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      android: { elevation: 1 },
    }),
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#17212F',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  requiredStar: {
    color: '#EF4444',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  textAreaInput: {
    height: 90,
    textAlignVertical: 'top',
  },
  fieldGroup: {
    gap: 6,
  },
  dropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownBtnCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  dropdownValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dropdownValueText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 10,
  },
  colHalf: {
    flex: 1,
    gap: 6,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  dateTextInput: {
    flex: 1,
    paddingVertical: 9,
    fontSize: 12,
    color: '#0F172A',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyNote: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  userChipSelected: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },
  userChipAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userChipAvatarSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  userChipAvatarText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#17365D',
  },
  userChipAvatarTextSelected: {
    color: '#FFFFFF',
  },
  userChipName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    maxWidth: 120,
  },
  userChipNameSelected: {
    color: '#FFFFFF',
  },
  labelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  labelChipText: {
    fontSize: 11,
  },
  badgeFs: {
    backgroundColor: '#EFF6FF',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  badgeFsText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  dependencyHint: {
    fontSize: 11,
    color: '#64748B',
  },
  dependenciesList: {
    maxHeight: 180,
    gap: 6,
  },
  dependencyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  dependencyItemSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  dependencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  checkboxSquare: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSquareChecked: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  dependencyCode: {
    fontSize: 11,
    fontWeight: '800',
    color: '#17365D',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dependencyTitle: {
    fontSize: 12,
    color: '#1E293B',
    flex: 1,
  },
  dependencyStatusPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dependencyStatusText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  addChecklistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addChecklistText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2878C7',
  },
  checklistsList: {
    gap: 8,
  },
  checklistItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checklistIndex: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    width: 18,
  },
  checklistInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0F172A',
  },
  removeChecklistBtn: {
    padding: 6,
  },
  drawerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  submitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#17365D',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Picker Modals */
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerModalCard: {
    width: '100%',
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickerList: {
    maxHeight: 350,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    borderRadius: 8,
  },
  pickerItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  pickerItemText: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
  },
  pickerItemTextSelected: {
    color: '#2878C7',
    fontWeight: '700',
  },
  pickerItemSubtext: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  priorityPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  boldText: {
    fontWeight: '700',
  },
});
