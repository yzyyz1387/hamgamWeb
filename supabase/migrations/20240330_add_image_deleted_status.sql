-- 添加 IMAGE_DELETED 状态到 submission_status 枚举
-- 用于标识已发布图片被管理员删除的情况

ALTER TYPE public.submission_status ADD VALUE IF NOT EXISTS 'IMAGE_DELETED';
