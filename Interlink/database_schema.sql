-- ==========================================================
-- INTERLINK ENTERPRISE DATABASE SCHEMA & SEED DATA
-- Target Domain: https://interlink.jeenhost.in/
-- Compatible with: MySQL 8.x / MariaDB 10.x / cPanel phpMyAdmin
-- ==========================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET NAMES utf8mb4;

-- ----------------------------------------------------------
-- Table structure for `attendance_adjustment_requests`
-- ----------------------------------------------------------
CREATE TABLE `attendance_adjustment_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL DEFAULT '1',
  `company_id` int NOT NULL DEFAULT '1',
  `user_id` int NOT NULL,
  `work_date` date NOT NULL,
  `requested_clock_in` time NOT NULL,
  `requested_clock_out` time NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `reviewer_id` int DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `reviewer_comment` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_aar_tenant_status` (`organization_id`,`company_id`,`status`),
  KEY `idx_aar_user_date` (`user_id`,`work_date`),
  KEY `reviewer_id` (`reviewer_id`),
  CONSTRAINT `attendance_adjustment_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_adjustment_requests_ibfk_2` FOREIGN KEY (`reviewer_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `attendance_daily_summaries`
-- ----------------------------------------------------------
CREATE TABLE `attendance_daily_summaries` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL DEFAULT '1',
  `company_id` int NOT NULL DEFAULT '1',
  `user_id` int NOT NULL,
  `work_date` date NOT NULL,
  `schedule_id` int DEFAULT NULL,
  `first_clock_in` timestamp NULL DEFAULT NULL,
  `last_clock_out` timestamp NULL DEFAULT NULL,
  `total_work_minutes` int NOT NULL DEFAULT '0',
  `total_break_minutes` int NOT NULL DEFAULT '0',
  `expected_work_minutes` int NOT NULL DEFAULT '480',
  `status` enum('PRESENT','LATE','HALF_DAY','ABSENT','ON_LEAVE','HOLIDAY','WEEKEND') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ABSENT',
  `late_minutes` int NOT NULL DEFAULT '0',
  `early_exit_minutes` int NOT NULL DEFAULT '0',
  `overtime_minutes` int NOT NULL DEFAULT '0',
  `is_regularized` tinyint(1) NOT NULL DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ads_user_date` (`organization_id`,`user_id`,`work_date`),
  KEY `idx_ads_tenant_date` (`organization_id`,`company_id`,`work_date`,`status`),
  KEY `user_id` (`user_id`),
  KEY `schedule_id` (`schedule_id`),
  CONSTRAINT `attendance_daily_summaries_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_daily_summaries_ibfk_2` FOREIGN KEY (`schedule_id`) REFERENCES `work_schedules` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `attendance_events`
-- ----------------------------------------------------------
CREATE TABLE `attendance_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL DEFAULT '1',
  `company_id` int NOT NULL DEFAULT '1',
  `user_id` int NOT NULL,
  `event_type` enum('CLOCK_IN','BREAK_START','BREAK_END','CLOCK_OUT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `location_type` enum('OFFICE','REMOTE','CLIENT_SITE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OFFICE',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `device_info` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ae_tenant_user_time` (`organization_id`,`company_id`,`user_id`,`event_time`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `attendance_events_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `audit_logs`
-- ----------------------------------------------------------
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `device_id` varchar(255) DEFAULT NULL,
  `master_name` varchar(255) NOT NULL,
  `change_type` varchar(50) NOT NULL,
  `before_data` text,
  `after_data` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `in_process_franchise_id` int DEFAULT NULL,
  `organization_id` int DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------
-- Table structure for `calendar_event_attendees`
-- ----------------------------------------------------------
CREATE TABLE `calendar_event_attendees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `guest_email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `guest_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_organizer` tinyint(1) DEFAULT '0',
  `rsvp_status` enum('needs_action','accepted','tentative','declined') COLLATE utf8mb4_unicode_ci DEFAULT 'needs_action',
  `response_notes` text COLLATE utf8mb4_unicode_ci,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_att_event` (`event_id`),
  KEY `idx_att_user` (`user_id`,`rsvp_status`),
  CONSTRAINT `calendar_event_attendees_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `calendar_events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `calendar_event_attendees_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `calendar_events`
-- ----------------------------------------------------------
CREATE TABLE `calendar_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL DEFAULT '1',
  `company_id` int NOT NULL DEFAULT '1',
  `calendar_id` int NOT NULL,
  `creator_id` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` longtext COLLATE utf8mb4_unicode_ci,
  `location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meeting_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_all_day` tinyint(1) DEFAULT '0',
  `start_time` datetime NOT NULL,
  `end_time` datetime NOT NULL,
  `timezone` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT 'UTC',
  `category` enum('general','meeting','task','reminder','holiday','out_of_office') COLLATE utf8mb4_unicode_ci DEFAULT 'general',
  `color_override` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_recurring` tinyint(1) DEFAULT '0',
  `recurrence_rule` json DEFAULT NULL,
  `recurrence_parent_id` int DEFAULT NULL,
  `recurrence_exception_date` date DEFAULT NULL,
  `linked_meeting_id` int DEFAULT NULL,
  `linked_task_id` int DEFAULT NULL,
  `linked_project_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_evt_time` (`start_time`,`end_time`),
  KEY `idx_evt_cal` (`calendar_id`),
  KEY `idx_evt_creator` (`creator_id`),
  KEY `idx_evt_parent` (`recurrence_parent_id`),
  CONSTRAINT `calendar_events_ibfk_1` FOREIGN KEY (`calendar_id`) REFERENCES `calendars` (`id`) ON DELETE CASCADE,
  CONSTRAINT `calendar_events_ibfk_2` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `calendar_events_ibfk_3` FOREIGN KEY (`recurrence_parent_id`) REFERENCES `calendar_events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `calendar_external_sync`
-- ----------------------------------------------------------
CREATE TABLE `calendar_external_sync` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `calendar_id` int NOT NULL,
  `provider` enum('google','microsoft') COLLATE utf8mb4_unicode_ci NOT NULL,
  `external_calendar_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sync_direction` enum('import_only','export_only','bidirectional') COLLATE utf8mb4_unicode_ci DEFAULT 'bidirectional',
  `access_token` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `refresh_token` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_expires_at` datetime NOT NULL,
  `sync_token` text COLLATE utf8mb4_unicode_ci,
  `webhook_channel_id` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `webhook_expires_at` datetime DEFAULT NULL,
  `last_synced_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `calendar_id` (`calendar_id`),
  KEY `idx_sync_user_provider` (`user_id`,`provider`),
  CONSTRAINT `calendar_external_sync_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `calendar_external_sync_ibfk_2` FOREIGN KEY (`calendar_id`) REFERENCES `calendars` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `calendar_shares`
-- ----------------------------------------------------------
CREATE TABLE `calendar_shares` (
  `id` int NOT NULL AUTO_INCREMENT,
  `calendar_id` int NOT NULL,
  `shared_with_user_id` int DEFAULT NULL,
  `shared_with_department_id` int DEFAULT NULL,
  `permission_level` enum('free_busy_only','view_details','edit','admin') COLLATE utf8mb4_unicode_ci DEFAULT 'free_busy_only',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_share_cal` (`calendar_id`),
  KEY `idx_share_user` (`shared_with_user_id`),
  CONSTRAINT `calendar_shares_ibfk_1` FOREIGN KEY (`calendar_id`) REFERENCES `calendars` (`id`) ON DELETE CASCADE,
  CONSTRAINT `calendar_shares_ibfk_2` FOREIGN KEY (`shared_with_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `calendars`
-- ----------------------------------------------------------
CREATE TABLE `calendars` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL DEFAULT '1',
  `company_id` int NOT NULL DEFAULT '1',
  `owner_id` int NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `color` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#2878C7',
  `type` enum('personal','shared','project','department','resource') COLLATE utf8mb4_unicode_ci DEFAULT 'personal',
  `department_id` int DEFAULT NULL,
  `project_id` int DEFAULT NULL,
  `is_default` tinyint(1) DEFAULT '0',
  `is_public` tinyint(1) DEFAULT '0',
  `timezone` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT 'UTC',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cal_tenant` (`organization_id`,`company_id`),
  KEY `idx_cal_owner` (`owner_id`),
  KEY `idx_cal_dept` (`department_id`),
  KEY `idx_cal_proj` (`project_id`),
  CONSTRAINT `calendars_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `chat_announcement_acknowledgements`
-- ----------------------------------------------------------
CREATE TABLE `chat_announcement_acknowledgements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `message_id` int NOT NULL,
  `user_id` int NOT NULL,
  `acknowledged_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ack_msg_user` (`message_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `chat_announcement_acknowledgements_ibfk_1` FOREIGN KEY (`message_id`) REFERENCES `chat_messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chat_announcement_acknowledgements_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `chat_conversations`
-- ----------------------------------------------------------
CREATE TABLE `chat_conversations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_id` int DEFAULT '1',
  `type` enum('DIRECT','GROUP','BROADCAST') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DIRECT',
  `title` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_admin_only` tinyint(1) DEFAULT '0',
  `broadcast_priority` enum('NORMAL','URGENT','COMPANY_UPDATE','POLICY_CHANGE') COLLATE utf8mb4_unicode_ci DEFAULT 'NORMAL',
  `target_department_id` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_message_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `project_id` int DEFAULT NULL,
  `historic_access_on_remove` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'VISIBLE',
  PRIMARY KEY (`id`),
  KEY `idx_cc_company` (`company_id`),
  KEY `idx_cc_type` (`type`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `chat_message_reports`
-- ----------------------------------------------------------
CREATE TABLE `chat_message_reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `message_id` int NOT NULL,
  `reporter_id` int NOT NULL,
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING','REVIEWED','DISMISSED','DELETED') COLLATE utf8mb4_unicode_ci DEFAULT 'PENDING',
  `moderator_id` int DEFAULT NULL,
  `moderated_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cmr_status` (`status`),
  KEY `message_id` (`message_id`),
  KEY `reporter_id` (`reporter_id`),
  CONSTRAINT `chat_message_reports_ibfk_1` FOREIGN KEY (`message_id`) REFERENCES `chat_messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chat_message_reports_ibfk_2` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `chat_messages`
-- ----------------------------------------------------------
CREATE TABLE `chat_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL,
  `sender_id` int NOT NULL,
  `message_text` text COLLATE utf8mb4_unicode_ci,
  `message_type` enum('TEXT','IMAGE','FILE','SYSTEM') COLLATE utf8mb4_unicode_ci DEFAULT 'TEXT',
  `file_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` int DEFAULT NULL,
  `file_mime` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parent_message_id` int DEFAULT NULL,
  `is_pinned` tinyint(1) DEFAULT '0',
  `is_announcement` tinyint(1) DEFAULT '0',
  `reactions` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `announcement_title` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `announcement_expiry` timestamp NULL DEFAULT NULL,
  `mentions` json DEFAULT NULL,
  `is_edited` tinyint(1) DEFAULT '0',
  `edited_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cm_conv` (`conversation_id`),
  KEY `idx_cm_sender` (`sender_id`),
  KEY `idx_cm_created` (`created_at`),
  CONSTRAINT `chat_messages_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chat_messages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `chat_participants`
-- ----------------------------------------------------------
CREATE TABLE `chat_participants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL,
  `user_id` int NOT NULL,
  `role` enum('ADMIN','MEMBER') COLLATE utf8mb4_unicode_ci DEFAULT 'MEMBER',
  `last_read_message_id` int DEFAULT '0',
  `last_read_at` timestamp NULL DEFAULT NULL,
  `is_muted` tinyint(1) DEFAULT '0',
  `is_pinned` tinyint(1) DEFAULT '0',
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_conv_user` (`conversation_id`,`user_id`),
  KEY `idx_cp_user` (`user_id`),
  KEY `idx_cp_conv` (`conversation_id`),
  CONSTRAINT `chat_participants_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chat_participants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `chat_settings`
-- ----------------------------------------------------------
CREATE TABLE `chat_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_id` int DEFAULT '1',
  `allow_direct_messaging` tinyint(1) DEFAULT '1',
  `allow_group_creation` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'ALL',
  `allow_broadcast_creation` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'ADMIN_ONLY',
  `allow_file_sharing` tinyint(1) DEFAULT '1',
  `max_file_size_mb` int DEFAULT '25',
  `cross_department_chat` tinyint(1) DEFAULT '1',
  `read_receipts_enabled` tinyint(1) DEFAULT '1',
  `typing_indicators_enabled` tinyint(1) DEFAULT '1',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `allow_file_downloads` tinyint(1) DEFAULT '1',
  `message_retention_days` int DEFAULT '0',
  `legal_hold_enabled` tinyint(1) DEFAULT '0',
  `allow_message_editing` tinyint(1) DEFAULT '1',
  `allow_message_deletion` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cs_company` (`company_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `chat_user_department_permissions`
-- ----------------------------------------------------------
CREATE TABLE `chat_user_department_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_id` int DEFAULT '1',
  `user_id` int NOT NULL,
  `chat_scope` enum('DEPARTMENT_ONLY','MULTI_DEPARTMENT','COMPANY_WIDE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DEPARTMENT_ONLY',
  `allowed_department_ids` json DEFAULT NULL,
  `can_direct_chat` tinyint(1) DEFAULT '1',
  `can_create_group` tinyint(1) DEFAULT '1',
  `can_create_broadcast` tinyint(1) DEFAULT '0',
  `can_send_files` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `can_download_files` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cudp_user` (`user_id`),
  KEY `idx_cudp_company` (`company_id`),
  CONSTRAINT `chat_user_department_permissions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `chat_user_type_permissions`
-- ----------------------------------------------------------
CREATE TABLE `chat_user_type_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_id` int DEFAULT '1',
  `user_type_id` int NOT NULL,
  `can_direct_chat` tinyint(1) DEFAULT '1',
  `can_create_group` tinyint(1) DEFAULT '1',
  `can_create_broadcast` tinyint(1) DEFAULT '0',
  `can_send_files` tinyint(1) DEFAULT '1',
  `can_download_files` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cutp` (`company_id`,`user_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `companies`
-- ----------------------------------------------------------
CREATE TABLE `companies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_comp_org` (`organization_id`),
  CONSTRAINT `companies_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed data for `companies`
INSERT IGNORE INTO `companies` (`id`, `organization_id`, `name`, `created_at`, `email`, `phone`) VALUES (1, 1, 'Main Company', '2026-11-23 06:05:36', NULL, NULL);

-- ----------------------------------------------------------
-- Table structure for `departments`
-- ----------------------------------------------------------
CREATE TABLE `departments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_id` int DEFAULT '1',
  `department_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `head_of_department` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE') COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dept_status` (`status`),
  KEY `idx_dept_company` (`company_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed data for `departments`
INSERT IGNORE INTO `departments` (`id`, `company_id`, `department_name`, `description`, `head_of_department`, `status`, `created_at`, `updated_at`) VALUES (1, 1, 'Executive Leadership', 'Strategy, executive direction, and corporate governance', 'Chief Executive Officer', 'ACTIVE', '2026-11-23 12:36:57', '2026-11-23 12:36:57');
INSERT IGNORE INTO `departments` (`id`, `company_id`, `department_name`, `description`, `head_of_department`, `status`, `created_at`, `updated_at`) VALUES (2, 1, 'Information Technology', 'Software engineering, infrastructure, devops, and security', 'Chief Technology Officer', 'ACTIVE', '2026-11-23 12:36:57', '2026-11-23 12:36:57');
INSERT IGNORE INTO `departments` (`id`, `company_id`, `department_name`, `description`, `head_of_department`, `status`, `created_at`, `updated_at`) VALUES (3, 1, 'Human Resources', 'People operations, talent acquisition, culture, and employee welfare', 'Head of People Operations', 'ACTIVE', '2026-11-23 12:36:57', '2026-11-23 12:36:57');
INSERT IGNORE INTO `departments` (`id`, `company_id`, `department_name`, `description`, `head_of_department`, `status`, `created_at`, `updated_at`) VALUES (4, 1, 'Sales & Business Development', 'Client partnerships, revenue growth, and corporate accounts', 'VP of Sales', 'ACTIVE', '2026-11-23 12:36:57', '2026-11-23 12:36:57');
INSERT IGNORE INTO `departments` (`id`, `company_id`, `department_name`, `description`, `head_of_department`, `status`, `created_at`, `updated_at`) VALUES (5, 1, 'Finance & Accounts', 'Treasury, taxation, billing, audits, and financial planning', 'Head of Finance', 'ACTIVE', '2026-11-23 12:36:57', '2026-11-23 12:36:57');
INSERT IGNORE INTO `departments` (`id`, `company_id`, `department_name`, `description`, `head_of_department`, `status`, `created_at`, `updated_at`) VALUES (6, 1, 'Operations & Quality Assurance', 'Process optimization, standards compliance, and client delivery', 'Operations Director', 'ACTIVE', '2026-11-23 12:36:57', '2026-11-23 12:36:57');
INSERT IGNORE INTO `departments` (`id`, `company_id`, `department_name`, `description`, `head_of_department`, `status`, `created_at`, `updated_at`) VALUES (7, 2, 'dev', 'dsadad', 'tanmay', 'ACTIVE', '2026-11-26 06:35:34', '2026-11-26 06:38:36');

-- ----------------------------------------------------------
-- Table structure for `meeting_notes`
-- ----------------------------------------------------------
CREATE TABLE `meeting_notes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `meeting_id` int NOT NULL,
  `author_id` int NOT NULL,
  `notes_content` longtext COLLATE utf8mb4_unicode_ci,
  `ai_summary` text COLLATE utf8mb4_unicode_ci,
  `action_items` json DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_meeting_note` (`meeting_id`),
  KEY `author_id` (`author_id`),
  CONSTRAINT `meeting_notes_ibfk_1` FOREIGN KEY (`meeting_id`) REFERENCES `meetings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `meeting_notes_ibfk_2` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `meeting_participants`
-- ----------------------------------------------------------
CREATE TABLE `meeting_participants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `meeting_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `guest_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `guest_email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('host','co_host','participant','guest') COLLATE utf8mb4_unicode_ci DEFAULT 'participant',
  `status` enum('waiting_room','admitted','rejected','left') COLLATE utf8mb4_unicode_ci DEFAULT 'admitted',
  `joined_at` datetime DEFAULT NULL,
  `left_at` datetime DEFAULT NULL,
  `duration_seconds` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_meeting_user` (`meeting_id`,`user_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `meeting_participants_ibfk_1` FOREIGN KEY (`meeting_id`) REFERENCES `meetings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `meeting_recordings`
-- ----------------------------------------------------------
CREATE TABLE `meeting_recordings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `meeting_id` int NOT NULL,
  `organization_id` int NOT NULL DEFAULT '1',
  `company_id` int NOT NULL DEFAULT '1',
  `file_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size_bytes` bigint DEFAULT '0',
  `duration_seconds` int DEFAULT '0',
  `recorded_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_meeting_rec` (`meeting_id`),
  KEY `recorded_by` (`recorded_by`),
  CONSTRAINT `meeting_recordings_ibfk_1` FOREIGN KEY (`meeting_id`) REFERENCES `meetings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `meeting_recordings_ibfk_2` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `meeting_whiteboards`
-- ----------------------------------------------------------
CREATE TABLE `meeting_whiteboards` (
  `id` int NOT NULL AUTO_INCREMENT,
  `meeting_id` int NOT NULL,
  `organization_id` int NOT NULL DEFAULT '1',
  `company_id` int NOT NULL DEFAULT '1',
  `project_id` int DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'Meeting Whiteboard',
  `canvas_data` longtext COLLATE utf8mb4_unicode_ci,
  `thumbnail_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_meeting_wb` (`meeting_id`),
  KEY `idx_project_wb` (`project_id`),
  CONSTRAINT `meeting_whiteboards_ibfk_1` FOREIGN KEY (`meeting_id`) REFERENCES `meetings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `meetings`
-- ----------------------------------------------------------
CREATE TABLE `meetings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL DEFAULT '1',
  `company_id` int NOT NULL DEFAULT '1',
  `project_id` int DEFAULT NULL,
  `task_id` int DEFAULT NULL,
  `room_code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `meeting_type` enum('instant','scheduled') COLLATE utf8mb4_unicode_ci DEFAULT 'instant',
  `host_id` int NOT NULL,
  `scheduled_start` datetime DEFAULT NULL,
  `scheduled_end` datetime DEFAULT NULL,
  `status` enum('scheduled','live','ended','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'scheduled',
  `is_lobby_enabled` tinyint(1) DEFAULT '1',
  `is_recording_allowed` tinyint(1) DEFAULT '0',
  `is_guest_allowed` tinyint(1) DEFAULT '1',
  `passcode` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `room_code` (`room_code`),
  KEY `idx_room_code` (`room_code`),
  KEY `idx_tenant_comp` (`organization_id`,`company_id`),
  KEY `idx_project` (`project_id`),
  KEY `idx_task` (`task_id`),
  KEY `host_id` (`host_id`),
  CONSTRAINT `meetings_ibfk_1` FOREIGN KEY (`host_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `note_activities`
-- ----------------------------------------------------------
CREATE TABLE `note_activities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `note_id` int NOT NULL,
  `user_id` int NOT NULL,
  `action_type` enum('created','updated','shared','permission_changed','access_revoked','pinned','unpinned','archived','unarchived','linked','unlinked','restored') COLLATE utf8mb4_unicode_ci NOT NULL,
  `details` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_activities_note` (`note_id`),
  CONSTRAINT `note_activities_ibfk_1` FOREIGN KEY (`note_id`) REFERENCES `notes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `note_activities_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `note_attachments`
-- ----------------------------------------------------------
CREATE TABLE `note_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `note_id` int NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` int NOT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `uploaded_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `idx_attachments_note` (`note_id`),
  CONSTRAINT `note_attachments_ibfk_1` FOREIGN KEY (`note_id`) REFERENCES `notes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `note_attachments_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `note_checklists`
-- ----------------------------------------------------------
CREATE TABLE `note_checklists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `note_id` int NOT NULL,
  `item_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_completed` tinyint(1) DEFAULT '0',
  `position` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_checklists_note` (`note_id`),
  CONSTRAINT `note_checklists_ibfk_1` FOREIGN KEY (`note_id`) REFERENCES `notes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `note_links`
-- ----------------------------------------------------------
CREATE TABLE `note_links` (
  `id` int NOT NULL AUTO_INCREMENT,
  `note_id` int NOT NULL,
  `entity_type` enum('task','project','meeting','knowledge') COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_links_note` (`note_id`),
  KEY `idx_links_entity` (`entity_type`,`entity_id`),
  CONSTRAINT `note_links_ibfk_1` FOREIGN KEY (`note_id`) REFERENCES `notes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `note_links_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `note_shares`
-- ----------------------------------------------------------
CREATE TABLE `note_shares` (
  `id` int NOT NULL AUTO_INCREMENT,
  `note_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `user_type_id` int DEFAULT NULL,
  `permission` enum('view','comment','edit') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'view',
  `shared_by` int NOT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `shared_by` (`shared_by`),
  KEY `idx_shares_note` (`note_id`),
  KEY `idx_shares_user` (`user_id`),
  KEY `idx_shares_group` (`user_type_id`),
  CONSTRAINT `note_shares_ibfk_1` FOREIGN KEY (`note_id`) REFERENCES `notes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `note_shares_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `note_shares_ibfk_3` FOREIGN KEY (`user_type_id`) REFERENCES `user_types` (`id`) ON DELETE CASCADE,
  CONSTRAINT `note_shares_ibfk_4` FOREIGN KEY (`shared_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `note_versions`
-- ----------------------------------------------------------
CREATE TABLE `note_versions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `note_id` int NOT NULL,
  `version_number` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` longtext COLLATE utf8mb4_unicode_ci,
  `edited_by` int NOT NULL,
  `change_summary` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `edited_by` (`edited_by`),
  KEY `idx_versions_note` (`note_id`),
  CONSTRAINT `note_versions_ibfk_1` FOREIGN KEY (`note_id`) REFERENCES `notes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `note_versions_ibfk_2` FOREIGN KEY (`edited_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `notes`
-- ----------------------------------------------------------
CREATE TABLE `notes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT '1',
  `company_id` int NOT NULL DEFAULT '1',
  `owner_id` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` longtext COLLATE utf8mb4_unicode_ci,
  `color` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '#FFFFFF',
  `is_pinned` tinyint(1) DEFAULT '0',
  `is_archived` tinyint(1) DEFAULT '0',
  `priority` enum('low','medium','high','urgent') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `labels` json DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `owner_id` (`owner_id`),
  KEY `idx_notes_tenant_owner` (`tenant_id`,`owner_id`),
  KEY `idx_notes_tenant_pinned` (`tenant_id`,`is_pinned`),
  KEY `idx_notes_tenant_archived` (`tenant_id`,`is_archived`),
  CONSTRAINT `notes_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `organizations`
-- ----------------------------------------------------------
CREATE TABLE `organizations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed data for `organizations`
INSERT IGNORE INTO `organizations` (`id`, `name`, `email`, `created_at`, `status`) VALUES (1, 'Default Organization', 'admin@example.com', '2026-11-23 06:05:36', 'approved');

-- ----------------------------------------------------------
-- Table structure for `project_baselines`
-- ----------------------------------------------------------
CREATE TABLE `project_baselines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `snapshot_data` json NOT NULL,
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `project_baselines_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_baselines_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `project_deliverables`
-- ----------------------------------------------------------
CREATE TABLE `project_deliverables` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `milestone_id` int DEFAULT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `owner_id` int NOT NULL,
  `due_date` date DEFAULT NULL,
  `status` enum('draft','in_review','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `sign_off_by` int DEFAULT NULL,
  `sign_off_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `milestone_id` (`milestone_id`),
  KEY `owner_id` (`owner_id`),
  KEY `sign_off_by` (`sign_off_by`),
  CONSTRAINT `project_deliverables_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_deliverables_ibfk_2` FOREIGN KEY (`milestone_id`) REFERENCES `project_milestones` (`id`) ON DELETE SET NULL,
  CONSTRAINT `project_deliverables_ibfk_3` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `project_deliverables_ibfk_4` FOREIGN KEY (`sign_off_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `project_documents`
-- ----------------------------------------------------------
CREATE TABLE `project_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` int NOT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('brief','contract','architecture','report','meeting_notes','general') COLLATE utf8mb4_unicode_ci DEFAULT 'general',
  `uploaded_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `project_documents_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_documents_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `project_members`
-- ----------------------------------------------------------
CREATE TABLE `project_members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `user_id` int NOT NULL,
  `role` enum('project_manager','tech_lead','contributor','reviewer','stakeholder') COLLATE utf8mb4_unicode_ci DEFAULT 'contributor',
  `allocation_percentage` int DEFAULT '100',
  `hourly_billing_rate` decimal(8,2) DEFAULT '0.00',
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_proj_user` (`project_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `project_members_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=367 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `project_milestones`
-- ----------------------------------------------------------
CREATE TABLE `project_milestones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `phase_id` int DEFAULT NULL,
  `title` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `due_date` date NOT NULL,
  `achieved_date` date DEFAULT NULL,
  `status` enum('pending','achieved','delayed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `phase_id` (`phase_id`),
  CONSTRAINT `project_milestones_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_milestones_ibfk_2` FOREIGN KEY (`phase_id`) REFERENCES `project_phases` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `project_phases`
-- ----------------------------------------------------------
CREATE TABLE `project_phases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `sort_order` int DEFAULT '0',
  `status` enum('pending','in_progress','completed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `project_phases_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `project_risks`
-- ----------------------------------------------------------
CREATE TABLE `project_risks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('technical','financial','schedule','operational','resource','external') COLLATE utf8mb4_unicode_ci DEFAULT 'technical',
  `probability` int NOT NULL DEFAULT '3',
  `impact` int NOT NULL DEFAULT '3',
  `severity_score` int DEFAULT '9',
  `status` enum('identified','monitoring','mitigating','closed') COLLATE utf8mb4_unicode_ci DEFAULT 'identified',
  `owner_id` int NOT NULL,
  `mitigation_plan` text COLLATE utf8mb4_unicode_ci,
  `contingency_plan` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `owner_id` (`owner_id`),
  CONSTRAINT `project_risks_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_risks_ibfk_2` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `project_templates`
-- ----------------------------------------------------------
CREATE TABLE `project_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT '1',
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'General',
  `default_phases` json NOT NULL,
  `default_milestones` json NOT NULL,
  `default_tasks` json NOT NULL,
  `created_by` int NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `projects`
-- ----------------------------------------------------------
CREATE TABLE `projects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT '1',
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `status` enum('planning','active','on_hold','completed','archived','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'planning',
  `manager_id` int DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` datetime DEFAULT NULL,
  `actual_completion_duration_days` decimal(6,1) DEFAULT NULL,
  `total_logged_hours` decimal(8,2) DEFAULT '0.00',
  `parent_project_id` int DEFAULT NULL,
  `priority` enum('low','medium','high','urgent') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `visibility` enum('public','private','restricted') COLLATE utf8mb4_unicode_ci DEFAULT 'public',
  `owner_id` int NOT NULL DEFAULT '1',
  `sponsor_id` int DEFAULT NULL,
  `baseline_start_date` date DEFAULT NULL,
  `baseline_end_date` date DEFAULT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'USD',
  `estimated_budget` decimal(12,2) DEFAULT '0.00',
  `approved_budget` decimal(12,2) DEFAULT '0.00',
  `is_budget_approved` tinyint(1) DEFAULT '0',
  `actual_cost` decimal(12,2) DEFAULT '0.00',
  `progress_percentage` decimal(5,2) DEFAULT '0.00',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `notes` longtext COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_status` (`tenant_id`,`status`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `reminder_delivery_logs`
-- ----------------------------------------------------------
CREATE TABLE `reminder_delivery_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `reminder_id` int NOT NULL,
  `user_id` int NOT NULL,
  `channel` enum('in_app','push','email') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('queued','sent','failed','suppressed_quiet_hours') COLLATE utf8mb4_unicode_ci DEFAULT 'sent',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `delivered_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_deliv_rem` (`reminder_id`),
  KEY `idx_deliv_user` (`user_id`),
  CONSTRAINT `reminder_delivery_logs_ibfk_1` FOREIGN KEY (`reminder_id`) REFERENCES `reminders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `reminder_preferences`
-- ----------------------------------------------------------
CREATE TABLE `reminder_preferences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `channel_in_app` tinyint(1) DEFAULT '1',
  `channel_push` tinyint(1) DEFAULT '1',
  `channel_email` tinyint(1) DEFAULT '1',
  `notify_tasks` json DEFAULT NULL,
  `notify_projects` json DEFAULT NULL,
  `notify_approvals` json DEFAULT NULL,
  `notify_meetings` json DEFAULT NULL,
  `notify_personal` json DEFAULT NULL,
  `quiet_hours_enabled` tinyint(1) DEFAULT '0',
  `quiet_hours_start` time DEFAULT '22:00:00',
  `quiet_hours_end` time DEFAULT '08:00:00',
  `timezone` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT 'UTC',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `reminder_preferences_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `reminders`
-- ----------------------------------------------------------
CREATE TABLE `reminders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL DEFAULT '1',
  `company_id` int NOT NULL DEFAULT '1',
  `user_id` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `source_type` enum('personal','task','project','document','approval','meeting') COLLATE utf8mb4_unicode_ci DEFAULT 'personal',
  `source_id` int DEFAULT NULL,
  `deep_link_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `trigger_at` datetime NOT NULL,
  `timezone` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT 'UTC',
  `is_recurring` tinyint(1) DEFAULT '0',
  `recurrence_rule` json DEFAULT NULL,
  `status` enum('pending','snoozed','completed','dismissed','escalated','expired') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `snooze_until` datetime DEFAULT NULL,
  `snooze_count` int DEFAULT '0',
  `completed_at` datetime DEFAULT NULL,
  `dismissed_at` datetime DEFAULT NULL,
  `escalation_enabled` tinyint(1) DEFAULT '0',
  `escalation_rule` json DEFAULT NULL,
  `escalated_at` datetime DEFAULT NULL,
  `escalated_to_user_id` int DEFAULT NULL,
  `dedup_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rem_trigger` (`status`,`trigger_at`),
  KEY `idx_rem_snooze` (`status`,`snooze_until`),
  KEY `idx_rem_dedup` (`dedup_hash`),
  KEY `idx_rem_source` (`source_type`,`source_id`),
  KEY `idx_rem_user` (`user_id`,`status`),
  CONSTRAINT `reminders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `task_activities`
-- ----------------------------------------------------------
CREATE TABLE `task_activities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_value` json DEFAULT NULL,
  `new_value` json DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_task_activity` (`task_id`,`created_at`),
  CONSTRAINT `task_activities_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `task_assignees`
-- ----------------------------------------------------------
CREATE TABLE `task_assignees` (
  `task_id` int NOT NULL,
  `user_id` int NOT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`task_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `task_assignees_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `task_assignees_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `task_attachments`
-- ----------------------------------------------------------
CREATE TABLE `task_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` int NOT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uploaded_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `task_attachments_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `task_attachments_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `task_automation_rules`
-- ----------------------------------------------------------
CREATE TABLE `task_automation_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT '1',
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `trigger_event` enum('on_status_change','on_due_date_passed','on_task_created') COLLATE utf8mb4_unicode_ci NOT NULL,
  `conditions` json NOT NULL,
  `actions` json NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `task_checklists`
-- ----------------------------------------------------------
CREATE TABLE `task_checklists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_completed` tinyint(1) DEFAULT '0',
  `sort_order` int DEFAULT '0',
  `completed_by` int DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  KEY `completed_by` (`completed_by`),
  CONSTRAINT `task_checklists_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `task_checklists_ibfk_2` FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `task_comments`
-- ----------------------------------------------------------
CREATE TABLE `task_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `user_id` int NOT NULL,
  `comment_text` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_comment_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  KEY `user_id` (`user_id`),
  KEY `parent_comment_id` (`parent_comment_id`),
  CONSTRAINT `task_comments_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `task_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `task_comments_ibfk_3` FOREIGN KEY (`parent_comment_id`) REFERENCES `task_comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `task_dependencies`
-- ----------------------------------------------------------
CREATE TABLE `task_dependencies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT '1',
  `predecessor_id` int NOT NULL,
  `successor_id` int NOT NULL,
  `dependency_type` enum('FS','SS','FF','SF') COLLATE utf8mb4_unicode_ci DEFAULT 'FS',
  `lag_days` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dep` (`predecessor_id`,`successor_id`),
  KEY `idx_successor` (`successor_id`),
  KEY `idx_predecessor` (`predecessor_id`),
  CONSTRAINT `task_dependencies_ibfk_1` FOREIGN KEY (`predecessor_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `task_dependencies_ibfk_2` FOREIGN KEY (`successor_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `task_labels`
-- ----------------------------------------------------------
CREATE TABLE `task_labels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT '1',
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '#2878C7',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_label` (`tenant_id`,`name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `task_labels_map`
-- ----------------------------------------------------------
CREATE TABLE `task_labels_map` (
  `task_id` int NOT NULL,
  `label_id` int NOT NULL,
  PRIMARY KEY (`task_id`,`label_id`),
  KEY `label_id` (`label_id`),
  CONSTRAINT `task_labels_map_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `task_labels_map_ibfk_2` FOREIGN KEY (`label_id`) REFERENCES `task_labels` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `task_saved_views`
-- ----------------------------------------------------------
CREATE TABLE `task_saved_views` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT '1',
  `user_id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `view_type` enum('list','kanban','calendar','timeline','gantt') COLLATE utf8mb4_unicode_ci NOT NULL,
  `filter_criteria` json NOT NULL,
  `sort_criteria` json NOT NULL,
  `column_visibility` json DEFAULT NULL,
  `is_default` tinyint(1) DEFAULT '0',
  `is_shared` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `task_templates`
-- ----------------------------------------------------------
CREATE TABLE `task_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT '1',
  `title` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `default_priority` enum('low','medium','high','urgent') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `estimated_hours` decimal(6,2) DEFAULT '0.00',
  `checklist_template` json DEFAULT NULL,
  `default_labels` json DEFAULT NULL,
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `task_time_entries`
-- ----------------------------------------------------------
CREATE TABLE `task_time_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT '1',
  `task_id` int NOT NULL,
  `user_id` int NOT NULL,
  `start_time` datetime NOT NULL,
  `end_time` datetime DEFAULT NULL,
  `duration_minutes` int NOT NULL DEFAULT '0',
  `is_billable` tinyint(1) DEFAULT '1',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `timesheet_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `task_time_entries_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `task_time_entries_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `task_watchers`
-- ----------------------------------------------------------
CREATE TABLE `task_watchers` (
  `task_id` int NOT NULL,
  `user_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`task_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `task_watchers_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `task_watchers_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `tasks`
-- ----------------------------------------------------------
CREATE TABLE `tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT '1',
  `task_code` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` longtext COLLATE utf8mb4_unicode_ci,
  `status` enum('backlog','todo','in_progress','in_review','done','cancelled','blocked') COLLATE utf8mb4_unicode_ci DEFAULT 'todo',
  `priority` enum('low','medium','high','urgent') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `owner_id` int NOT NULL,
  `assigned_team_id` int DEFAULT NULL,
  `project_id` int DEFAULT NULL,
  `ticket_id` int DEFAULT NULL,
  `meeting_id` int DEFAULT NULL,
  `document_id` int DEFAULT NULL,
  `start_date` datetime DEFAULT NULL,
  `due_date` datetime DEFAULT NULL,
  `estimated_hours` decimal(6,2) DEFAULT '0.00',
  `actual_hours` decimal(6,2) DEFAULT '0.00',
  `completed_at` datetime DEFAULT NULL,
  `is_recurring` tinyint(1) DEFAULT '0',
  `recurrence_rule` json DEFAULT NULL,
  `parent_task_id` int DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `phase_id` int DEFAULT NULL,
  `milestone_id` int DEFAULT NULL,
  `baseline_start_date` date DEFAULT NULL,
  `baseline_due_date` date DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `owner_id` (`owner_id`),
  KEY `parent_task_id` (`parent_task_id`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_tenant_project` (`tenant_id`,`project_id`),
  KEY `idx_tenant_due_date` (`tenant_id`,`due_date`),
  CONSTRAINT `tasks_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `tasks_ibfk_2` FOREIGN KEY (`parent_task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `time_entries`
-- ----------------------------------------------------------
CREATE TABLE `time_entries` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL DEFAULT '1',
  `company_id` int NOT NULL DEFAULT '1',
  `timesheet_id` int NOT NULL,
  `user_id` int NOT NULL,
  `project_id` int NOT NULL,
  `task_id` int DEFAULT NULL,
  `work_date` date NOT NULL,
  `duration_minutes` int NOT NULL,
  `duration_hours` decimal(5,2) GENERATED ALWAYS AS ((`duration_minutes` / 60.0)) STORED,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_billable` tinyint(1) NOT NULL DEFAULT '1',
  `category` enum('DEVELOPMENT','DESIGN','MEETING','QA','SUPPORT','DOCUMENTATION','OTHER') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DEVELOPMENT',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_te_timesheet` (`timesheet_id`),
  KEY `idx_te_tenant_proj` (`organization_id`,`project_id`,`work_date`),
  KEY `idx_te_user_date` (`user_id`,`work_date`),
  KEY `project_id` (`project_id`),
  KEY `task_id` (`task_id`),
  CONSTRAINT `time_entries_ibfk_1` FOREIGN KEY (`timesheet_id`) REFERENCES `timesheets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `time_entries_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `time_entries_ibfk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `time_entries_ibfk_4` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `timesheet_approvals`
-- ----------------------------------------------------------
CREATE TABLE `timesheet_approvals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL DEFAULT '1',
  `timesheet_id` int NOT NULL,
  `actor_id` int NOT NULL,
  `action` enum('SUBMIT','APPROVE','REJECT','REQUEST_REVISION','UNLOCK') COLLATE utf8mb4_unicode_ci NOT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ta_timesheet` (`timesheet_id`),
  KEY `actor_id` (`actor_id`),
  CONSTRAINT `timesheet_approvals_ibfk_1` FOREIGN KEY (`timesheet_id`) REFERENCES `timesheets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `timesheet_approvals_ibfk_2` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `timesheets`
-- ----------------------------------------------------------
CREATE TABLE `timesheets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL DEFAULT '1',
  `company_id` int NOT NULL DEFAULT '1',
  `user_id` int NOT NULL,
  `period_start_date` date NOT NULL,
  `period_end_date` date NOT NULL,
  `total_hours` decimal(6,2) NOT NULL DEFAULT '0.00',
  `billable_hours` decimal(6,2) NOT NULL DEFAULT '0.00',
  `non_billable_hours` decimal(6,2) NOT NULL DEFAULT '0.00',
  `status` enum('DRAFT','SUBMITTED','APPROVED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `is_locked` tinyint(1) NOT NULL DEFAULT '0',
  `submitted_at` timestamp NULL DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ts_user_period` (`organization_id`,`user_id`,`period_start_date`),
  KEY `idx_ts_tenant_status` (`organization_id`,`company_id`,`status`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `timesheets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `user_companies`
-- ----------------------------------------------------------
CREATE TABLE `user_companies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `company_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_comp` (`user_id`,`company_id`),
  KEY `idx_uc_user` (`user_id`),
  KEY `idx_uc_comp` (`company_id`),
  CONSTRAINT `user_companies_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_companies_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=61 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `user_departments`
-- ----------------------------------------------------------
CREATE TABLE `user_departments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `department_id` int NOT NULL,
  `department_role` enum('ADMIN','USER') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USER',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_dept` (`user_id`,`department_id`),
  KEY `idx_ud_user` (`user_id`),
  KEY `idx_ud_dept` (`department_id`),
  CONSTRAINT `user_departments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_departments_ibfk_2` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `user_devices`
-- ----------------------------------------------------------
CREATE TABLE `user_devices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `device_id` varchar(255) NOT NULL,
  `status` enum('pending','approved','revoked') DEFAULT 'pending',
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  `closed_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `approved_by` (`approved_by`),
  KEY `closed_by` (`closed_by`),
  CONSTRAINT `user_devices_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_devices_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `user_devices_ibfk_3` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------
-- Table structure for `user_schedule_assignments`
-- ----------------------------------------------------------
CREATE TABLE `user_schedule_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL DEFAULT '1',
  `company_id` int NOT NULL DEFAULT '1',
  `user_id` int NOT NULL,
  `schedule_id` int NOT NULL,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_usa_user_eff` (`organization_id`,`user_id`,`effective_from`),
  KEY `user_id` (`user_id`),
  KEY `schedule_id` (`schedule_id`),
  CONSTRAINT `user_schedule_assignments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_schedule_assignments_ibfk_2` FOREIGN KEY (`schedule_id`) REFERENCES `work_schedules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Table structure for `user_type_permissions`
-- ----------------------------------------------------------
CREATE TABLE `user_type_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_type_id` int NOT NULL,
  `master_name` varchar(100) NOT NULL,
  `can_read` tinyint(1) DEFAULT '0',
  `can_write` tinyint(1) DEFAULT '0',
  `can_update` tinyint(1) DEFAULT '0',
  `can_delete` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ut_master` (`user_type_id`,`master_name`),
  CONSTRAINT `user_type_permissions_ibfk_1` FOREIGN KEY (`user_type_id`) REFERENCES `user_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=475 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Seed data for `user_type_permissions`
INSERT IGNORE INTO `user_type_permissions` (`id`, `user_type_id`, `master_name`, `can_read`, `can_write`, `can_update`, `can_delete`) VALUES (1, 1, 'user_type', 1, 1, 0, 0);
INSERT IGNORE INTO `user_type_permissions` (`id`, `user_type_id`, `master_name`, `can_read`, `can_write`, `can_update`, `can_delete`) VALUES (2, 1, 'user_master', 1, 1, 0, 0);
INSERT IGNORE INTO `user_type_permissions` (`id`, `user_type_id`, `master_name`, `can_read`, `can_write`, `can_update`, `can_delete`) VALUES (3, 1, 'device_approval', 0, 0, 0, 0);
INSERT IGNORE INTO `user_type_permissions` (`id`, `user_type_id`, `master_name`, `can_read`, `can_write`, `can_update`, `can_delete`) VALUES (4, 1, 'activity_report', 0, 0, 0, 0);
INSERT IGNORE INTO `user_type_permissions` (`id`, `user_type_id`, `master_name`, `can_read`, `can_write`, `can_update`, `can_delete`) VALUES (5, 1, 'projects', 0, 0, 0, 0);
INSERT IGNORE INTO `user_type_permissions` (`id`, `user_type_id`, `master_name`, `can_read`, `can_write`, `can_update`, `can_delete`) VALUES (6, 1, 'tasks', 0, 0, 0, 0);
INSERT IGNORE INTO `user_type_permissions` (`id`, `user_type_id`, `master_name`, `can_read`, `can_write`, `can_update`, `can_delete`) VALUES (7, 1, 'notes', 0, 0, 0, 0);
INSERT IGNORE INTO `user_type_permissions` (`id`, `user_type_id`, `master_name`, `can_read`, `can_write`, `can_update`, `can_delete`) VALUES (8, 1, 'chat', 1, 1, 1, 1);
INSERT IGNORE INTO `user_type_permissions` (`id`, `user_type_id`, `master_name`, `can_read`, `can_write`, `can_update`, `can_delete`) VALUES (9, 1, 'meetings', 1, 1, 1, 1);
INSERT IGNORE INTO `user_type_permissions` (`id`, `user_type_id`, `master_name`, `can_read`, `can_write`, `can_update`, `can_delete`) VALUES (10, 1, 'attendance', 1, 1, 1, 1);
INSERT IGNORE INTO `user_type_permissions` (`id`, `user_type_id`, `master_name`, `can_read`, `can_write`, `can_update`, `can_delete`) VALUES (11, 1, 'timesheets', 1, 1, 1, 1);
INSERT IGNORE INTO `user_type_permissions` (`id`, `user_type_id`, `master_name`, `can_read`, `can_write`, `can_update`, `can_delete`) VALUES (12, 1, 'company_master', 1, 1, 1, 1);
INSERT IGNORE INTO `user_type_permissions` (`id`, `user_type_id`, `master_name`, `can_read`, `can_write`, `can_update`, `can_delete`) VALUES (13, 1, 'department_master', 0, 0, 0, 0);
INSERT IGNORE INTO `user_type_permissions` (`id`, `user_type_id`, `master_name`, `can_read`, `can_write`, `can_update`, `can_delete`) VALUES (14, 1, 'chat_settings_master', 0, 0, 0, 0);

-- ----------------------------------------------------------
-- Table structure for `user_types`
-- ----------------------------------------------------------
CREATE TABLE `user_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type_name` varchar(100) NOT NULL,
  `added_by` int NOT NULL,
  `device_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `organization_id` int DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `type_name` (`type_name`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Seed data for `user_types`
INSERT IGNORE INTO `user_types` (`id`, `type_name`, `added_by`, `device_id`, `created_at`, `updated_at`, `organization_id`, `company_id`) VALUES (1, 'hr-sat', 2, 'DEV-NIAASHBO', '2026-11-23 11:58:50', '2026-11-23 11:58:50', NULL, NULL);

-- ----------------------------------------------------------
-- Table structure for `users`
-- ----------------------------------------------------------
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(50) DEFAULT 'user',
  `user_type_id` int DEFAULT NULL,
  `mob_no` varchar(20) DEFAULT NULL,
  `date_of_join` date DEFAULT NULL,
  `device_verification_required` tinyint(1) DEFAULT '1',
  `device_id` varchar(255) DEFAULT NULL,
  `modules` json DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `organization_id` int DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `department_id` int DEFAULT NULL,
  `designation` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------
-- Table structure for `work_schedules`
-- ----------------------------------------------------------
CREATE TABLE `work_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL DEFAULT '1',
  `company_id` int NOT NULL DEFAULT '1',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `schedule_type` enum('FIXED','FLEXIBLE','ROTATIONAL') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'FIXED',
  `start_time` time NOT NULL DEFAULT '09:00:00',
  `end_time` time NOT NULL DEFAULT '18:00:00',
  `break_duration_minutes` int NOT NULL DEFAULT '60',
  `grace_period_minutes` int NOT NULL DEFAULT '15',
  `half_day_threshold_minutes` int NOT NULL DEFAULT '240',
  `full_day_threshold_minutes` int NOT NULL DEFAULT '480',
  `work_days` json NOT NULL,
  `timezone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UTC',
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ws_tenant` (`organization_id`,`company_id`,`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- Seed Developer & Administrator Accounts
-- ----------------------------------------------------------
INSERT INTO `users` (`id`, `name`, `username`, `email`, `password`, `role`, `organization_id`, `company_id`, `device_verification_required`, `active`) 
VALUES (1, 'Platform Developer', 'developer', 'developer@interlink.com', '$2b$10$V2/4JjQbPDh8ki/xU0a5e.pOrxFNrcPoHTrHS6EchuxwRFJsSgQk.', 'super_admin', 1, 1, 0, 1)
ON DUPLICATE KEY UPDATE `password` = VALUES(`password`), `role` = 'super_admin', `active` = 1, `device_verification_required` = 0;

INSERT INTO `users` (`id`, `name`, `username`, `email`, `password`, `role`, `organization_id`, `company_id`, `device_verification_required`, `active`) 
VALUES (2, 'Organization Admin', 'admin', 'admin@interlink.com', '$2b$10$OLZwj8xfW6p5JWHjuh8H3.lw3zQItvTK4mQ2GOJ1FI9k0OFQxnkTS', 'admin', 1, 1, 0, 1)
ON DUPLICATE KEY UPDATE `password` = VALUES(`password`), `role` = 'admin', `active` = 1, `device_verification_required` = 0;

INSERT IGNORE INTO `user_companies` (`user_id`, `company_id`) VALUES (1, 1), (2, 1);

SET FOREIGN_KEY_CHECKS = 1;
