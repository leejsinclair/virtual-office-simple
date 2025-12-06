# GitHub Repository Setup Instructions

Your local git repository is ready! Follow these steps to create a GitHub repository and push your code.

## Step 1: Create a New Repository on GitHub

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the **"+"** icon in the top right corner
3. Select **"New repository"**
4. Fill in the repository details:
   - **Repository name**: `virtual-office` (or your preferred name)
   - **Description**: "A real-time virtual office application with proximity-based chat and video conferencing"
   - **Visibility**: Choose Public or Private
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click **"Create repository"**

## Step 2: Connect Your Local Repository to GitHub

After creating the repository, GitHub will show you commands. Use these (replace `YOUR_USERNAME` with your GitHub username):

```bash
cd /home/lee/projects/virtual-office

# Add the remote repository
git remote add origin https://github.com/YOUR_USERNAME/virtual-office.git

# Or if you prefer SSH:
# git remote add origin git@github.com:YOUR_USERNAME/virtual-office.git

# Push your code to GitHub
git push -u origin main
```

## Step 3: Verify

1. Go to your repository on GitHub
2. You should see all your files including:
   - README.md
   - Docker files
   - Source code
   - Documentation

## Alternative: Using GitHub CLI

If you have GitHub CLI installed:

```bash
gh repo create virtual-office --public --source=. --remote=origin --push
```

## Next Steps

- Add topics/tags to your repository on GitHub (e.g., `nextjs`, `webrtc`, `socket.io`)
- Consider adding a LICENSE file
- Set up GitHub Actions for CI/CD if desired
- Add collaborators if working with a team
