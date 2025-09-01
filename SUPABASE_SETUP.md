# Supabase 数据库设置教程

## 步骤 1: 删除现有表

1. 登录到 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧菜单的 **Table Editor**
4. 删除以下现有表（如果存在的话）：
   - `account_profiles`
   - `search_history` 
   - `twitter_analytics`
   - 或其他任何相关表

**删除步骤**：
- 点击表名
- 点击右上角的 **Settings** 按钮
- 选择 **Delete table**
- 确认删除

## 步骤 2: 创建新的数据库结构

1. 在 Supabase Dashboard 中，点击左侧菜单的 **SQL Editor**
2. 点击 **New Query**
3. 复制 `database-schema.sql` 文件的全部内容
4. 粘贴到 SQL 编辑器中
5. 点击 **Run** 按钮执行

## 步骤 3: 验证表创建

回到 **Table Editor**，你应该能看到以下新表：

### 主要表：
- **`twitter_users`** - 推特用户信息
- **`tweets`** - 推文数据
- **`collection_sessions`** - 数据收集记录
- **`search_history`** - 用户搜索历史

### 视图：
- **`tweets_with_user`** - 包含用户信息的推文视图
- **`user_stats`** - 用户统计视图

## 步骤 4: 检查 RLS 策略

1. 点击任一表，选择 **Settings** -> **Policies**
2. 确认 Row Level Security (RLS) 已启用
3. 验证策略已正确创建

## 步骤 5: 测试数据库连接

在项目根目录运行以下命令测试连接：
```bash
npm run dev
```

然后访问应用，尝试获取推特数据，检查数据是否正确保存到数据库。

## 数据表结构说明

### `twitter_users` 表
存储推特用户的基本信息：
- 用户名、显示名称、简介
- 粉丝数、关注数、推文总数
- 头像、验证状态、创建时间等

### `tweets` 表
存储推文的详细信息：
- 推文内容、创建时间
- 点赞数、转发数、回复数
- 媒体数据、实体信息
- 关联到 `twitter_users` 表

### `collection_sessions` 表
记录每次数据收集的会话：
- 收集了多少推文
- 处理了多少页
- 使用了多少API调用
- 收集状态和错误信息

### `search_history` 表
记录用户的搜索历史：
- 搜索的用户名
- 搜索类型（推文收集、媒体搜索、分析）
- 搜索参数和结果数量

## 注意事项

1. **备份现有数据**：删除表之前，如果有重要数据请先备份
2. **环境变量**：确保 `.env.local` 中的 Supabase 配置正确
3. **权限检查**：确认你有足够的权限执行 DDL 操作
4. **索引优化**：schema 已包含必要的索引，提高查询性能

## 常见问题

**Q: 执行 SQL 时出现权限错误？**
A: 确认你是项目的 Owner 或有足够权限的成员

**Q: RLS 策略不生效？**
A: 检查是否为每个表都启用了 RLS，并且策略语法正确

**Q: 应用连接数据库失败？**
A: 检查环境变量配置，确保 URL 和 Key 正确