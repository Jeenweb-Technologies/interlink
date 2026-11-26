import { apiRequest, ApiResponse } from './apiClient';

export interface ChecklistItem {
  id?: number;
  note_id?: number;
  item_text: string;
  is_completed: boolean;
  position?: number;
}

export interface NoteAttachment {
  id: number;
  note_id: number;
  file_name: string;
  file_path: string;
  file_url: string;
  file_size: number;
  mime_type?: string;
  uploader_name?: string;
  created_at?: string;
}

export interface NoteLink {
  id?: number;
  note_id?: number;
  entity_type: 'task' | 'project';
  entity_id: number | string;
  title?: string;
  created_at?: string;
}

export interface NoteShare {
  id: number;
  note_id: number;
  user_id?: number | null;
  user_type_id?: number | null;
  user_name?: string;
  user_email?: string;
  group_name?: string;
  permission: 'view' | 'comment' | 'edit';
  expires_at?: string | null;
  created_at?: string;
}

export interface CollaboratorUser {
  id: number;
  name: string;
  email: string;
  username?: string;
  role?: string;
}

export interface CollaboratorGroup {
  id: number;
  type_name: string;
}

export interface CollaboratorsMetaData {
  users: CollaboratorUser[];
  groups: CollaboratorGroup[];
}

export interface LinkableEntitiesData {
  tasks: Array<{
    id: number;
    title: string;
    task_code: string;
    status?: string;
    priority?: string;
  }>;
  projects: Array<{
    id: number;
    title: string;
    project_code?: string;
    status?: string;
  }>;
}

export interface NoteItem {
  id: number;
  tenant_id?: number;
  company_id?: number;
  owner_id?: number;
  owner_name?: string;
  owner_email?: string;
  owner_username?: string;
  title: string;
  content: string;
  color?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  is_pinned: boolean;
  is_archived: boolean;
  labels?: string[];
  version?: number;
  my_permission?: 'owner' | 'edit' | 'comment' | 'view';
  total_checklists?: number;
  completed_checklists?: number;
  attachments_count?: number;
  links_count?: number;
  shares_count?: number;
  checklists?: ChecklistItem[];
  attachments?: NoteAttachment[];
  links?: NoteLink[];
  shares?: NoteShare[];
  created_at?: string;
  updated_at?: string;
}

export interface NoteListResponse {
  success: boolean;
  scope: string;
  count: number;
  notes: NoteItem[];
}

export interface FetchNotesParams {
  scope?: 'my_notes' | 'shared_with_me' | 'archived';
  priority?: string;
  color?: string;
  search?: string;
  q?: string;
}

/**
 * Fetch notes list by scope ('my_notes' | 'shared_with_me' | 'archived')
 */
export const fetchNotes = async (
  params: FetchNotesParams = {}
): Promise<ApiResponse<NoteListResponse>> => {
  const searchParams = new URLSearchParams();
  if (params.scope) searchParams.append('scope', params.scope);
  if (params.priority && params.priority !== 'all') {
    searchParams.append('priority', params.priority);
  }
  if (params.color && params.color !== 'all') {
    searchParams.append('color', params.color);
  }
  if (params.search) {
    searchParams.append('q', params.search);
  } else if (params.q) {
    searchParams.append('q', params.q);
  }

  const queryStr = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const res = await apiRequest(`/notes${queryStr}`, {
    method: 'GET',
  });

  // Backend returns: { success: true, scope: '...', count: N, notes: [...] }
  const rawNotes =
    (res as any).notes ||
    res.data?.notes ||
    (Array.isArray(res.data) ? res.data : []);
  const safeNotes = Array.isArray(rawNotes) ? rawNotes : [];

  return {
    ...res,
    notes: safeNotes,
    data: {
      success: res.success,
      scope: (res as any).scope || params.scope || 'my_notes',
      count: (res as any).count ?? safeNotes.length,
      notes: safeNotes,
    },
  };
};

/**
 * Get single note by ID with full details (checklists, attachments, links, shares)
 */
export const fetchNoteById = async (
  id: number
): Promise<ApiResponse<{ note: NoteItem }>> => {
  const res = await apiRequest(`/notes/${id}`, {
    method: 'GET',
  });
  const noteData = (res as any).note || res.data?.note || res.data;
  return {
    ...res,
    note: noteData,
    data: {
      note: noteData,
    },
  };
};

/**
 * Toggle pin status for a note
 */
export const togglePinNoteApi = async (
  id: number
): Promise<ApiResponse<{ is_pinned: boolean; message: string }>> => {
  const res = await apiRequest(`/notes/${id}/pin`, {
    method: 'PATCH',
  });
  const isPinned =
    (res as any).is_pinned !== undefined
      ? Boolean((res as any).is_pinned)
      : Boolean(res.data?.is_pinned);
  return {
    ...res,
    is_pinned: isPinned,
    data: {
      is_pinned: isPinned,
      message: (res as any).message || res.message || '',
    },
  };
};

/**
 * Create a new note with checklists, links, labels
 */
export const createNoteApi = async (data: {
  title: string;
  content?: string;
  color?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  labels?: string[];
  is_pinned?: boolean;
  checklists?: ChecklistItem[];
  links?: NoteLink[];
}): Promise<ApiResponse<{ note?: NoteItem; noteId?: number }>> => {
  const res = await apiRequest('/notes', {
    method: 'POST',
    body: data,
  });
  return {
    ...res,
    noteId: (res as any).noteId || res.data?.noteId,
    data: {
      note: (res as any).note || res.data?.note,
      noteId: (res as any).noteId || res.data?.noteId,
    },
  };
};

/**
 * Update an existing note
 */
export const updateNoteApi = async (
  id: number,
  data: Partial<NoteItem> & { change_summary?: string }
): Promise<ApiResponse<{ note: NoteItem; version?: number }>> => {
  return apiRequest(`/notes/${id}`, {
    method: 'PUT',
    body: data,
  });
};

/**
 * Delete a note
 */
export const deleteNoteApi = async (id: number): Promise<ApiResponse<void>> => {
  return apiRequest(`/notes/${id}`, {
    method: 'DELETE',
  });
};

/**
 * Toggle checklist item completion
 */
export const toggleChecklistItemApi = async (
  noteId: number,
  checklistId: number
): Promise<ApiResponse<{ checklistId: number; is_completed: boolean }>> => {
  return apiRequest(`/notes/${noteId}/checklists/${checklistId}/toggle`, {
    method: 'PUT',
  });
};

/**
 * Fetch collaborators meta (users and groups for sharing)
 */
export const fetchCollaboratorsMetaApi = async (): Promise<
  ApiResponse<CollaboratorsMetaData>
> => {
  const res = await apiRequest('/notes/collaborators-meta', {
    method: 'GET',
  });
  return {
    ...res,
    data: {
      users: (res as any).users || res.data?.users || [],
      groups: (res as any).groups || res.data?.groups || [],
    },
  };
};

/**
 * Share note with user or group
 */
export const shareNoteApi = async (
  noteId: number,
  payload: {
    userId?: number | string;
    userTypeId?: number | string;
    permission: 'view' | 'comment' | 'edit';
    expiresAt?: string | null;
  }
): Promise<ApiResponse<void>> => {
  return apiRequest(`/notes/${noteId}/shares`, {
    method: 'POST',
    body: payload,
  });
};

/**
 * Revoke note share
 */
export const revokeNoteShareApi = async (
  noteId: number,
  shareId: number
): Promise<ApiResponse<void>> => {
  return apiRequest(`/notes/${noteId}/shares/${shareId}`, {
    method: 'DELETE',
  });
};

/**
 * Fetch linkable entities (tasks and projects)
 */
export const fetchLinkableEntitiesApi = async (): Promise<
  ApiResponse<LinkableEntitiesData>
> => {
  const res = await apiRequest('/notes/linkable-entities', {
    method: 'GET',
  });
  return {
    ...res,
    data: {
      tasks: (res as any).tasks || res.data?.tasks || [],
      projects: (res as any).projects || res.data?.projects || [],
    },
  };
};

/**
 * Add entity link to note
 */
export const addNoteLinkApi = async (
  noteId: number,
  link: {
    entity_type: 'task' | 'project';
    entity_id: number | string;
    title: string;
  }
): Promise<ApiResponse<void>> => {
  return apiRequest(`/notes/${noteId}/links`, {
    method: 'POST',
    body: link,
  });
};

/**
 * Delete entity link from note
 */
export const deleteNoteLinkApi = async (
  noteId: number,
  linkId: number
): Promise<ApiResponse<void>> => {
  return apiRequest(`/notes/${noteId}/links/${linkId}`, {
    method: 'DELETE',
  });
};

/**
 * Upload attachment file (multipart/form-data)
 */
export const uploadNoteAttachmentApi = async (
  noteId: number,
  formData: FormData
): Promise<ApiResponse<{ attachment: NoteAttachment }>> => {
  return apiRequest(`/notes/${noteId}/attachments`, {
    method: 'POST',
    body: formData,
  });
};

/**
 * Delete attachment from note
 */
export const deleteNoteAttachmentApi = async (
  noteId: number,
  attachmentId: number
): Promise<ApiResponse<void>> => {
  return apiRequest(`/notes/${noteId}/attachments/${attachmentId}`, {
    method: 'DELETE',
  });
};
