-- Supabase数据库迁移脚本
-- 为现有的tweets表添加view_count字段
-- 执行方式：在Supabase Dashboard的SQL Editor中运行此脚本

-- 步骤1：为tweets表添加view_count字段
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- 步骤2：为新字段添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_tweets_view_count ON tweets(view_count DESC);

-- 步骤3：更新现有记录的view_count字段（可选）
-- 可以根据点赞数和转发数估算浏览量，或设为0等待真实数据
UPDATE tweets
SET view_count = CASE
  WHEN like_count + retweet_count > 0
  THEN (like_count + retweet_count) * 10  -- 简单估算：互动数*10
  ELSE 0
END
WHERE view_count = 0;

-- 步骤4：添加注释说明
COMMENT ON COLUMN tweets.view_count IS '推文浏览量数据，从Twitter API v2获取';

-- 完成！现在tweets表已经包含view_count字段
-- 可以在应用代码中使用这个新字段