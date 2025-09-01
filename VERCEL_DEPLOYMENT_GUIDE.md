# Vercel 部署指南 - Twitter Analytics Pro

本指南将帮助你零基础部署这个推特数据分析工具到 Vercel。

## 前置要求

1. 一个 GitHub 账号
2. 一个 Vercel 账号
3. 一个 Supabase 账号
4. Twitter API 密钥（可选，用于数据收集功能）

## 第一步：准备 GitHub 仓库

### 1.1 创建 GitHub 账号
如果你还没有 GitHub 账号：
1. 访问 [github.com](https://github.com)
2. 点击 "Sign up" 注册
3. 选择免费计划即可

### 1.2 创建新仓库
1. 登录 GitHub 后，点击右上角的 "+" 号
2. 选择 "New repository"
3. 仓库名填写：`twitter-analytics-pro`
4. 设置为 Public（公开）
5. 点击 "Create repository"

### 1.3 上传项目代码
1. 下载并安装 [GitHub Desktop](https://desktop.github.com/)
2. 或者使用命令行：
```bash
# 在项目目录下执行
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/twitter-analytics-pro.git
git push -u origin main
```

## 第二步：设置 Supabase

### 2.1 创建 Supabase 账号
1. 访问 [supabase.com](https://supabase.com)
2. 点击 "Start your project"
3. 用 GitHub 账号登录

### 2.2 创建新项目
1. 点击 "New project"
2. 选择组织（通常是你的用户名）
3. 项目名称：`twitter-analytics-pro`
4. 数据库密码：设置一个强密码并记住
5. 地区选择：`Southeast Asia (Singapore)` （距离中国较近）
6. 点击 "Create new project"

### 2.3 获取项目配置
1. 等待项目创建完成（大约2分钟）
2. 进入项目面板
3. 点击左侧的 "Settings" → "API"
4. 记录以下信息：
   - **Project URL**: `https://你的项目id.supabase.co`
   - **anon public key**: `eyJ...` (很长的字符串)

### 2.4 设置认证
1. 点击左侧的 "Authentication"
2. 点击 "Settings" 标签页
3. 在 "Site URL" 中填入：`https://你的vercel域名.vercel.app`（第一次可以先填 `http://localhost:3000`）
4. 保存设置

## 第三步：部署到 Vercel

### 3.1 创建 Vercel 账号
1. 访问 [vercel.com](https://vercel.com)
2. 点击 "Sign Up"
3. 选择用 GitHub 账号登录

### 3.2 导入项目
1. 登录 Vercel 后，点击 "New Project"
2. 找到你刚创建的 `twitter-analytics-pro` 仓库
3. 点击 "Import"

### 3.3 配置环境变量
在部署配置页面：
1. 展开 "Environment Variables" 部分
2. 添加以下环境变量：

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | 你的 Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 你的 Supabase anon public key |

### 3.4 部署设置
1. Framework Preset: `Next.js`
2. Root Directory: `./`（默认）
3. Build and Output Settings: 保持默认
4. 点击 "Deploy"

### 3.5 等待部署完成
1. 部署过程大约需要 2-5 分钟
2. 完成后会显示部署成功页面
3. 点击 "Visit" 访问你的网站

## 第四步：更新 Supabase 设置

### 4.1 更新网站 URL
1. 复制 Vercel 提供的网站域名（如：`https://twitter-analytics-pro-xxx.vercel.app`）
2. 回到 Supabase 项目
3. 进入 Authentication → Settings
4. 将 "Site URL" 更新为你的 Vercel 域名
5. 保存设置

## 第五步：测试功能

### 5.1 基本功能测试
1. 访问你的网站
2. 尝试注册新账号
3. 检查登录功能
4. 测试图片推文检索功能
5. 测试推特数据分析功能

### 5.2 常见问题排查

**问题 1: 显示环境变量警告**
- 检查 Vercel 中的环境变量是否正确设置
- 重新部署项目：在 Vercel 面板点击 "Redeploy"

**问题 2: 认证不工作**
- 确认 Supabase 中的 Site URL 设置正确
- 检查环境变量是否包含正确的 Supabase 配置

**问题 3: Twitter 功能不工作**
- Twitter API 功能需要额外的 API 密钥配置
- 目前项目使用模拟数据，所以这个功能可能需要进一步配置

## 第六步：自定义域名（可选）

### 6.1 购买域名
1. 在域名注册商处购买域名（如 Namecheap、阿里云等）

### 6.2 在 Vercel 中添加域名
1. 进入 Vercel 项目设置
2. 点击 "Domains"
3. 添加你的域名
4. 按照提示配置 DNS 记录

### 6.3 更新 Supabase 设置
1. 将新域名添加到 Supabase 的 Site URL 中

## 维护和更新

### 更新代码
1. 修改本地代码
2. 提交到 GitHub：
```bash
git add .
git commit -m "更新描述"
git push
```
3. Vercel 会自动检测更新并重新部署

### 查看日志
1. 在 Vercel 面板中，点击项目
2. 点击 "Functions" 查看服务器日志
3. 点击 "Deployments" 查看部署历史

## 成本说明

- **Vercel**: 免费计划足够个人使用
- **Supabase**: 免费计划包含：
  - 500MB 数据库
  - 50,000 每月活跃用户
  - 5GB 带宽
- **域名**: 可选，通常每年 $10-50

## 技术支持

如果遇到问题：
1. 检查 Vercel 部署日志
2. 检查 Supabase 项目状态
3. 确认环境变量配置正确
4. 重新部署项目试试

## 注意事项

1. **数据安全**: 不要在代码中硬编码任何密钥
2. **访问限制**: 考虑设置 Supabase 的行级安全策略
3. **备份**: 定期备份 Supabase 数据库
4. **监控**: 关注 Vercel 和 Supabase 的使用量

完成以上步骤后，你的推特数据分析工具就成功部署到了 Vercel！🎉