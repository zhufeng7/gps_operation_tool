-- 新的数据库架构设计
-- 删除所有现有表，重新创建

-- 1. 推特用户表
CREATE TABLE twitter_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twitter_id TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  description TEXT,
  profile_image_url TEXT,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  tweet_count INTEGER DEFAULT 0,
  listed_count INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  account_created_at TIMESTAMP WITH TIME ZONE,
  location TEXT,
  website_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 推文表
CREATE TABLE tweets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT UNIQUE NOT NULL,
  twitter_user_id UUID REFERENCES twitter_users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  like_count INTEGER DEFAULT 0,
  retweet_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  quote_count INTEGER DEFAULT 0,
  impression_count BIGINT,
  engagement_score FLOAT DEFAULT 0,
  has_media BOOLEAN DEFAULT false,
  media_data JSONB,
  entities JSONB,
  context_annotations JSONB,
  conversation_id TEXT,
  in_reply_to_user_id TEXT,
  possibly_sensitive BOOLEAN DEFAULT false,
  source TEXT,
  lang TEXT,
  referenced_tweets JSONB,
  tweet_url TEXT,
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 数据收集记录表
CREATE TABLE collection_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  twitter_user_id UUID REFERENCES twitter_users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  total_tweets_collected INTEGER DEFAULT 0,
  pages_processed INTEGER DEFAULT 0,
  api_calls_used INTEGER DEFAULT 0,
  collection_status TEXT DEFAULT 'in_progress', -- 'completed', 'failed', 'partial'
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  time_span_days INTEGER DEFAULT 0,
  oldest_tweet_date TIMESTAMP WITH TIME ZONE,
  newest_tweet_date TIMESTAMP WITH TIME ZONE,
  metadata JSONB
);

-- 4. 用户搜索历史表  
CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username_searched TEXT NOT NULL,
  search_type TEXT NOT NULL, -- 'tweet_collection', 'media_search', 'analysis'
  results_count INTEGER DEFAULT 0,
  search_params JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX idx_twitter_users_username ON twitter_users(username);
CREATE INDEX idx_twitter_users_twitter_id ON twitter_users(twitter_id);
CREATE INDEX idx_tweets_twitter_user_id ON tweets(twitter_user_id);
CREATE INDEX idx_tweets_tweet_id ON tweets(tweet_id);
CREATE INDEX idx_tweets_created_at ON tweets(created_at DESC);
CREATE INDEX idx_tweets_engagement_score ON tweets(engagement_score DESC);
CREATE INDEX idx_tweets_has_media ON tweets(has_media);
-- 可选：按浏览量排序/过滤的索引
CREATE INDEX IF NOT EXISTS idx_tweets_impression_count ON tweets(impression_count);
CREATE INDEX idx_collection_sessions_user_id ON collection_sessions(user_id);
CREATE INDEX idx_collection_sessions_username ON collection_sessions(username);
CREATE INDEX idx_search_history_user_id ON search_history(user_id);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_twitter_users_updated_at 
  BEFORE UPDATE ON twitter_users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) 策略
ALTER TABLE twitter_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- 允许认证用户读取所有推特用户和推文数据
CREATE POLICY "Allow authenticated users to read twitter users" 
  ON twitter_users FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated users to read tweets" 
  ON tweets FOR SELECT 
  TO authenticated 
  USING (true);

-- 只允许用户访问自己的收集记录和搜索历史
CREATE POLICY "Users can only access their own collection sessions" 
  ON collection_sessions FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own search history" 
  ON search_history FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id);

-- 允许认证用户插入/更新推特用户和推文数据
CREATE POLICY "Allow authenticated users to insert twitter users" 
  ON twitter_users FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update twitter users" 
  ON twitter_users FOR UPDATE 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated users to insert tweets" 
  ON tweets FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- 创建视图：带用户信息的推文
CREATE VIEW tweets_with_user AS
SELECT 
  t.*,
  u.username,
  u.display_name,
  u.profile_image_url,
  u.verified,
  u.followers_count
FROM tweets t
JOIN twitter_users u ON t.twitter_user_id = u.id;

-- 创建视图：用户统计
CREATE VIEW user_stats AS
SELECT 
  u.*,
  COUNT(t.id) as collected_tweets_count,
  MAX(t.created_at) as latest_tweet_date,
  MIN(t.created_at) as earliest_tweet_date,
  COALESCE(AVG(t.engagement_score), 0) as avg_engagement,
  COUNT(CASE WHEN t.has_media = true THEN 1 END) as media_tweets_count
FROM twitter_users u
LEFT JOIN tweets t ON u.id = t.twitter_user_id
GROUP BY u.id;