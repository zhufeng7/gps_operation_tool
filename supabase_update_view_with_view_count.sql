-- Supabase视图更新脚本
-- 更新tweets_with_user视图以包含view_count字段
-- 执行方式：在Supabase Dashboard的SQL Editor中运行此脚本

-- 步骤1：先删除现有视图（如果存在）
DROP VIEW IF EXISTS tweets_with_user;

-- 步骤2：重新创建包含view_count字段的视图
CREATE VIEW tweets_with_user AS
SELECT
  t.id,
  t.tweet_id,
  t.text,
  t.created_at,
  t.like_count,
  t.retweet_count,
  t.reply_count,
  t.quote_count,
  t.view_count,  -- 新增的浏览量字段
  t.engagement_score,
  t.has_media,
  t.media_data,
  t.entities,
  t.context_annotations,
  t.conversation_id,
  t.in_reply_to_user_id,
  t.possibly_sensitive,
  t.source,
  t.lang,
  t.referenced_tweets,
  t.tweet_url,
  t.collected_at,
  u.username,
  u.display_name,
  u.profile_image_url,
  u.followers_count,
  u.following_count,
  u.verified
FROM tweets t
INNER JOIN twitter_users u ON t.twitter_user_id = u.id
ORDER BY t.created_at DESC;

-- 步骤3：为视图添加注释
COMMENT ON VIEW tweets_with_user IS '推文与用户信息的联合视图，包含浏览量数据';

-- 完成！现在tweets_with_user视图已经包含view_count字段