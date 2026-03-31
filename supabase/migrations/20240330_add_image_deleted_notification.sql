-- 添加 IMAGE_DELETED 通知类型
-- 用于通知用户其图片已被管理员删除

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'IMAGE_DELETED';
