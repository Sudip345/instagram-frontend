class ProfilePage {
    constructor() {
        this.baseUrl = 'http://localhost:8080';//'https://instagram-wnh3.onrender.com';
        this.currentUser = null;
        this.loggedInUser = null;
        this.profileUser = null;
        this.profileUserAvatar = '1.png';
        this.loggedInUserAvatar = '1.png';
        this.defaultPostImage = '1.png';
        this.currentTab = 'posts';
        this.selectedAvatarFile = null;
        this.cropper = null;
        this.allPosts = [];
        this.currentPostIndex = 0;
        this.currentPostId = null;
        this.expandedReplies = new Set();
        this.stories = [];
        this.currentStoryIndex = 0;
        this.allStories = [];
        this.isCroppingForStory = false;
        this.isPostingStory = false;
        this.filesToCrop = [];
        this.croppedFiles = [];
        this.reportTargetId = null; // New property to store the ID of the item being reported (post or user)
        this.reportType = null; // New property to store whether it's a 'post' or 'user' report

        this.init();
    }

    parseBioSafely(bioString) {
        if (typeof bioString !== 'string') {
            return bioString;
        }
        let parsed = bioString;
        try {
            // Keep parsing as long as it's a stringified JSON
            while (typeof parsed === 'string' && (parsed.startsWith('{') || parsed.startsWith('"'))) {
                const temp = JSON.parse(parsed);
                if (typeof temp === 'object' && temp !== null && 'bio' in temp) {
                    parsed = temp.bio;
                } else if (typeof temp === 'string') {
                    parsed = temp; // Handle cases where the string itself was just quoted
                } else {
                    break; // Not a bio object, or not a string, stop parsing
                }
            }
        } catch (e) {
            // If parsing fails, it means it's not a JSON string, so return the original
            return bioString;
        }
        return parsed;
    }

    async updateFollowRequestsDot() {
        const followRequestsDot = document.getElementById('followRequestsDot');
        if (followRequestsDot) {
            if (this.loggedInUser && this.loggedInUser.receivedRequests && this.loggedInUser.receivedRequests.length > 0) {
                followRequestsDot.style.display = 'block';
            } else {
                followRequestsDot.style.display = 'none';
            }
        }
    }

    async init() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const targetUsername = urlParams.get('username');

            await this.loadCurrentUser();
            await this.updateFollowRequestsDot(); // Update dot after current user is loaded

            if (!targetUsername || targetUsername === this.currentUser) {
                await this.loadOwnProfile();
            } else {
                await this.loadUserProfile(targetUsername);
            }

            // The updateMoreOptionsModalDisplay is now called within setupEventListeners
            // to ensure elements are available.
            this.setupEventListeners();
            await this.fetchAllStories();
            this.setupStoryModalEventListeners();
            await this.updateProfileDisplay(); // Await this to ensure profileUser is fully processed
            await this.displayCommonFollowers(); // Call this after profileUser is loaded and display is updated

            // Conditionally load posts based on profile lock status
            if (this.profileUser.isLocked && this.profileUser.username !== this.currentUser) {
                const isFollowing = await this.checkIfUserFollowing(this.profileUser.username);
                if (isFollowing) {
                    await this.loadPosts();
                }
                // If not following, the UI is already handled by updateProfileDisplay,
                // which shows the lock icon and appropriate message. We just need to avoid calling loadPosts.
            } else {
                // Not a locked profile, or it's the current user's own profile
                await this.loadPosts();
            }

        } catch (error) {
            console.error('Error initializing profile:', error);
            this.handleError('Failed to load profile');
        }
    }

    async fetchCommonFollowers(username) {
        try {
            const response = await fetch(`${this.baseUrl}/user/get-common-followers/user=${encodeURIComponent(username)}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            //.error('Error fetching common followers:', error);
            return [];
        }
    }

    async displayCommonFollowers() {
        const commonFollowersSection = document.getElementById('commonFollowersSection');
        if (!commonFollowersSection) return;

        // Only show this section if viewing another user's profile
        if (this.profileUser.username === this.currentUser) {
            commonFollowersSection.style.display = 'none';
            return;
        }

        const commonFollowers = await this.fetchCommonFollowers(this.profileUser.username);
        commonFollowersSection.innerHTML = ''; // Clear previous content

        if (commonFollowers && commonFollowers.length > 0) {
            commonFollowersSection.style.display = 'block';
            let text = 'Followed by ';
            let avatarsHtml = '';

            if (commonFollowers.length === 1) {
                const follower = commonFollowers[0];
                const avatarUrl = await this.getUserAvatar(follower.username);
                text += `<span class="common-follower-username">${follower.username}</span>`;
                avatarsHtml = `<img src="${avatarUrl}" alt="${follower.username}" class="common-follower-avatar">`;
            } else if (commonFollowers.length === 2) {
                const follower1 = commonFollowers[0];
                const follower2 = commonFollowers[1];
                const avatarUrl1 = await this.getUserAvatar(follower1.username);
                const avatarUrl2 = await this.getUserAvatar(follower2.username);
                text += `<span class="common-follower-username">${follower1.username}</span> and <span class="common-follower-username">${follower2.username}</span>`;
                avatarsHtml = `
                    <img src="${avatarUrl1}" alt="${follower1.username}" class="common-follower-avatar">
                    <img src="${avatarUrl2}" alt="${follower2.username}" class="common-follower-avatar">
                `;
            } else { // More than 2 people
                const follower1 = commonFollowers[0];
                const follower2 = commonFollowers[1];
                const avatarUrl1 = await this.getUserAvatar(follower1.username);
                const avatarUrl2 = await this.getUserAvatar(follower2.username);
                const othersCount = commonFollowers.length - 2;
                text += `<span class="common-follower-username">${follower1.username}</span>, <span class="common-follower-username">${follower2.username}</span> and ${othersCount} Others`;
                avatarsHtml = `
                    <img src="${avatarUrl1}" alt="${follower1.username}" class="common-follower-avatar">
                    <img src="${avatarUrl2}" alt="${follower2.username}" class="common-follower-avatar">
                `;
            }

            const commonFollowersContent = document.createElement('div');
            commonFollowersContent.className = 'common-followers-content';
            commonFollowersContent.innerHTML = `
                <div class="common-followers-avatars">${avatarsHtml}</div>
                <p>${text}</p>
            `;
            commonFollowersSection.appendChild(commonFollowersContent);

            // Make usernames clickable
            commonFollowersSection.querySelectorAll('.common-follower-username').forEach(span => {
                const username = span.textContent;
                this.makeUsernameClickable(span, username);
            });

        } else {
            commonFollowersSection.style.display = 'none';
        }
    }

    async updateProfileDisplay() {
        if (!this.profileUser) return;
        //.log('updateProfileDisplay called. profileUser.isLocked:', this.profileUser.isLocked);
    
        try {
            const profilePic = document.getElementById('profilePic');
            if (profilePic) {
                profilePic.src = this.profileUserAvatar;
            }
        } catch (error) {
            //.error('Error updating profile display:', error);
        }
    }

    async loadCurrentUser() {
        try {
            const response = await fetch(`${this.baseUrl}/user`, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.status === 401 || response.status === 403) {
                window.location.href = 'login.html';
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const user = await response.json();
            //.log('Raw user data from loadCurrentUser:', user);
            this.loggedInUser = user;
            this.loggedInUser.isLocked = !!user.locked; 
            this.currentUser = user.username;
            //.log('loadCurrentUser - Current user:', this.currentUser, 'isLocked from backend:', user.isLocked, 'processed isLocked:', this.loggedInUser.isLocked);

            if (this.loggedInUser.profileAvatarID) {
                try {
                    const avatarResponse = await fetch(`${this.baseUrl}/files/get-files/file-id=${this.loggedInUser.profileAvatarID}`, {
                        credentials: 'include'
                    });
                    if (avatarResponse.ok) {
                        const blob = await avatarResponse.blob();
                        this.loggedInUserAvatar = URL.createObjectURL(blob);
                    }
                } catch (error) {
                    //.warn('Failed to load logged-in user avatar:', error);
                }
            }

        } catch (error) {
            //.error('Error loading current user:', error);
            window.location.href = 'login.html';
        }
    }

    async loadOwnProfile() {
        try {
            //.log('Loading own profile...');
            const response = await fetch(`${this.baseUrl}/user`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const user = await response.json();
            //.log('Raw user data from loadOwnProfile:', user);
            this.profileUser = user;
            this.profileUser.isLocked = !!user.locked; // Use 'locked' property from backend
            this.profileUser.bio = this.parseBioSafely(user.bio); // Safely parse bio

            if (user.profileAvatarID) {
                await this.loadUserAvatar(user.profileAvatarID);
            }

            //.log('loadOwnProfile - Profile loaded:', user.username, 'isLocked from backend:', user.isLocked, 'processed isLocked:', this.profileUser.isLocked);

        } catch (error) {
            //.error('Error loading own profile:', error);
            throw error;
        }
    }

    async loadUserProfile(username) {
        try {
            //.log('Loading profile for user:', username);
            const response = await fetch(`${this.baseUrl}/user/get-user/username=${encodeURIComponent(username)}`, {
                method: 'GET',
                credentials: 'include'
            });

            // This handles cases like 423 Locked where the body contains partial user info.
            const user = await response.json();

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('User not found');
                }
                // For 423 (Locked) or other non-ok statuses that return a body
                if (user) {
                    this.profileUser = user;
                    this.profileUser.isLocked = true; // Explicitly set lock status
                    this.profileUser.bio = this.parseBioSafely(user.bio); // Safely parse bio
                    //.log(`Profile loaded with status ${response.status}:`, user);
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } else {
                this.profileUser = user;
                this.profileUser.isLocked = !!user.locked; // Ensure isLocked is always a boolean
                this.profileUser.bio = this.parseBioSafely(user.bio); // Safely parse bio
                //.log('User profile loaded (200 OK):', user, 'isLocked:', this.profileUser.isLocked);
            }

            if (this.profileUser && this.profileUser.profileAvatarID) {
                await this.loadUserAvatar(this.profileUser.profileAvatarID);
            } else if (!this.profileUser) {
                throw new Error('Failed to retrieve profile data.');
            }

        } catch (error) {
            //.error('Error in loadUserProfile:', error);
            // If an error is caught, it means we couldn't load the profile at all.
            // This will be caught by init() and display the "Failed to load profile" message.
            throw error;
        }
    }

    async loadUserAvatar(profileAvatarID) {
        try {
            const avatarResponse = await fetch(`${this.baseUrl}/files/get-files/file-id=${profileAvatarID}`, {
                credentials: 'include'
            });

            if (avatarResponse.ok) {
                const blob = await avatarResponse.blob();
                this.profileUserAvatar = URL.createObjectURL(blob);
            }
        } catch (error) {
            //.warn('Failed to load user avatar:', error);
        }
    }

    async fetchCommonFollowers(username) {
        try {
            const response = await fetch(`${this.baseUrl}/user/get-common-followers/user=${encodeURIComponent(username)}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            //.error('Error fetching common followers:', error);
            return [];
        }
    }

    async updateProfileDisplay() {
        if (!this.profileUser) return;
    
        try {
            const profilePic = document.getElementById('profilePic');
            if (profilePic) {
                profilePic.src = this.profileUserAvatar;
            }
    
            const usernameElement = document.querySelector('.username');
            if (usernameElement) {
                usernameElement.textContent = this.profileUser.username || '';
            }
    
            const realnameElement = document.querySelector('.realname');
            if (realnameElement) {
                realnameElement.textContent = this.profileUser.realName || '';
            }
    
            const bioElement = document.querySelector('.bio-text');
            if (bioElement) {
                bioElement.innerText = this.profileUser.bio || '';
            }
    
            const bioLinksElement = document.getElementById('bioLinks');
            if (bioLinksElement) {
                bioLinksElement.innerHTML = '';
                if (this.profileUser.links && this.profileUser.links.length > 0) {
                    this.profileUser.links.forEach(link => {
                        const li = document.createElement('li');
                        const a = document.createElement('a');
                        a.href = link;
                        a.textContent = link;
                        a.target = '_blank';
                        a.rel = "noopener noreferrer";
                        li.prepend(a);
                        bioLinksElement.prepend(li);
                    });
                }
            }
    
            this.setupMoreButton();
    
            const postsCountElement = document.querySelector('#postsCount .stat-number');
            const followersCountElement = document.querySelector('#followersCount .stat-number');
            const followingCountElement = document.querySelector('#followingCount .stat-number');
            const stats = document.querySelectorAll('.profile-stats .stat');
    
            const editProfileBtn = document.getElementById('editProfileBtn');
            const followActionBtn = document.getElementById('followActionBtn');
            const followRequestsIcon = document.getElementById('followRequestsIcon');
            const moreOptionsBtn = document.getElementById('moreOptions');
            const postsGrid = document.getElementById('postsGrid');
            const noPosts = document.getElementById('noPosts');
            const postsTab = document.getElementById('postsTab');
            const savedTab = document.getElementById('savedTab');
    
            if (this.profileUser.username === this.currentUser) {
                // Own profile
                if (editProfileBtn) {
                    editProfileBtn.style.display = 'block';
                    editProfileBtn.textContent = 'Edit profile';
                    editProfileBtn.className = 'edit-profile-btn';
                }
                if (followActionBtn) followActionBtn.style.display = 'none';
                if (followRequestsIcon) followRequestsIcon.style.display = 'block';
                if (moreOptionsBtn) moreOptionsBtn.style.display = 'block';
                if (savedTab) savedTab.style.display = 'flex';
                if (postsTab) postsTab.style.display = 'flex';
                postsGrid.style.display = 'grid';
                noPosts.style.display = 'none';
                stats.forEach(stat => {
                    stat.style.pointerEvents = 'auto';
                    stat.style.cursor = 'pointer';
                });
                if (postsCountElement) postsCountElement.textContent = this.profileUser.numberOfPosts || '0';
                if (followersCountElement) followersCountElement.textContent = (this.profileUser.numberOfFollower);
                if (followingCountElement) followingCountElement.textContent = (this.profileUser.numberOfFollowings);
    
                const addStoryBtn = document.getElementById('add-story-btn');
                if (addStoryBtn) {
                    addStoryBtn.style.display = 'block';
                }

            } else {
                // Other user's profile
                if (editProfileBtn) editProfileBtn.style.display = 'none';
                if (followRequestsIcon) followRequestsIcon.style.display = 'none';
                if (moreOptionsBtn) moreOptionsBtn.style.display = 'none';
                if (savedTab) savedTab.style.display = 'none';
    
                const isFollowing = await this.checkIfUserFollowing(this.profileUser.username);
                const isRequestSent = await this.checkIfFollowRequestSent(this.profileUser.username);
    
                if (this.profileUser.isLocked && !isFollowing) {
                    if (postsCountElement) postsCountElement.textContent = this.profileUser.numberOfPosts || '0';
                    if (followersCountElement) followersCountElement.textContent = (this.profileUser.numberOfFollower);
                    if (followingCountElement) followingCountElement.textContent = (this.profileUser.numberOfFollowings);
                    stats.forEach(stat => {
                        stat.style.pointerEvents = 'auto';
                        stat.style.cursor = 'pointer';
                    });
    
                    postsGrid.style.display = 'none';
                    noPosts.style.display = 'block';
                    if (postsTab) postsTab.style.display = 'none';
    
                    if (!isRequestSent) {
                        noPosts.innerHTML = `
                            <i class="fas fa-lock"></i>
                            <h3>This Account is Private</h3>
                            <p>Follow this account to see their photos and videos.</p>
                        `;
                    } else {
                        noPosts.innerHTML = `
                            <i class="fas fa-lock"></i>
                            <h3>This Account is Private</h3>
                            <p>Your follow request is pending.</p>
                        `;
                    }
                } else {
                    if (postsCountElement) postsCountElement.textContent = this.profileUser.numberOfPosts || '0';
                    if (followersCountElement) followersCountElement.textContent = (this.profileUser.numberOfFollower);
                    if (followingCountElement) followingCountElement.textContent = (this.profileUser.numberOfFollowings);
                    stats.forEach(stat => {
                        stat.style.pointerEvents = 'auto';
                        stat.style.cursor = 'pointer';
                    });
                    if (postsTab) postsTab.style.display = 'flex';
                    postsGrid.style.display = 'grid';
                    noPosts.style.display = 'none';
                }
    
                if (followActionBtn) {
                    followActionBtn.style.display = 'block';
                    if (this.profileUser.isLocked) {
                        this.checkAndUpdateFollowRequestButton(followActionBtn);
                    } else {
                        this.checkAndUpdateFollowButton(followActionBtn);
                    }
                }
            }
        } catch (error) {
            //.error('Error updating profile display:', error);
        }
    }

    async checkAndUpdateFollowButton(buttonElement) {
        try {
            // Use the local state check instead of making another API call
            const isFollowing = this.checkUserFollowing(this.profileUser.username); 
            buttonElement.textContent = isFollowing ? 'Following' : 'Follow';
            buttonElement.className = isFollowing ? 'follow-btn following' : 'follow-btn';
            buttonElement.setAttribute('data-following', isFollowing);
            buttonElement.style.display = 'block';
        } catch (error) {
            //.error('Error checking follow status:', error);
            buttonElement.textContent = 'Follow';
            buttonElement.className = 'follow-btn';
            buttonElement.setAttribute('data-following', 'false');
            buttonElement.style.display = 'block';
        }
    }

    async checkAndUpdateFollowRequestButton(buttonElement) {
        try {
            const isFollowing = await this.checkIfUserFollowing(this.profileUser.username);
            const isRequestSent = await this.checkIfFollowRequestSent(this.profileUser.username);
            //.log('checkAndUpdateFollowRequestButton - isFollowing:', isFollowing, 'isRequestSent:', isRequestSent);

            if (isFollowing) {
                buttonElement.textContent = 'Following';
                buttonElement.className = 'follow-btn following';
                buttonElement.disabled = false; // Allow unfollowing
            } else if (isRequestSent) {
                buttonElement.textContent = 'Requested';
                buttonElement.className = 'follow-request-btn requested';
                buttonElement.disabled = false;
            } else {
                buttonElement.textContent = 'Send Follow Request';
                buttonElement.className = 'follow-request-btn';
                buttonElement.disabled = false;
            }
            buttonElement.style.display = 'block';
        } catch (error) {
            //.error('Error checking follow request status:', error);
            buttonElement.textContent = 'Send Follow Request';
            buttonElement.className = 'follow-request-btn';
            buttonElement.disabled = false;
            buttonElement.style.display = 'block';
        }
    }

    setupEventListeners() {
        const profilePic = document.getElementById('profilePic');
        if (profilePic) {
            profilePic.addEventListener('click', () => {
                this.openProfilePictureViewer();
            });
        }

        const editProfileBtn = document.getElementById('editProfileBtn');
        const followActionBtn = document.getElementById('followActionBtn');
        const followRequestsIcon = document.getElementById('followRequestsIcon');
        const moreOptionsBtn = document.getElementById('moreOptions');

        if (editProfileBtn) {
            editProfileBtn.addEventListener('click', () => {
                if (this.profileUser.username === this.currentUser) {
                    this.openEditProfile();
                }
            });
        }

        const addStoryBtn = document.getElementById('add-story-btn');
        if (addStoryBtn) {
            addStoryBtn.addEventListener('click', () => {
                this.openCreatePostModalForStory();
            });
        }

        // Setup story modal form submission
        this.setupStoryModal();

        if (moreOptionsBtn) {
            moreOptionsBtn.addEventListener('click', async () => { // Make it async
                if (this.profileUser.username === this.currentUser) {
                    // Removed redundant await this.loadOwnProfile(); as it's handled in toggleProfileLockStatus
                    this.openModal('moreOptionsModal');
                    this.updateMoreOptionsModalDisplay(); // Update options visibility based on fresh data
                } else {
                    this.showMessage('You can only manage options for your own profile.', 'error');
                }
            });
        }

        if (followActionBtn) {
            followActionBtn.addEventListener('click', async () => {
                if (this.profileUser.isLocked) {
                    const isFollowing = await this.checkIfUserFollowing(this.profileUser.username);
                    if (isFollowing) {
                        // If already following a locked profile, unfollow
                        await this.toggleFollow();
                    } else {
                        // If not following, send/cancel follow request
                        await this.toggleFollowRequest();
                    }
                } else {
                    // For public profiles, toggle follow directly
                    await this.toggleFollow();
                }
            });
        }

        if (followRequestsIcon) {
            followRequestsIcon.addEventListener('click', () => {
                this.openFollowRequestsModal();
            });
        }

        const changeAvatarBtn = document.getElementById('changeAvatarBtn');
        const avatarInput = document.getElementById('avatarInput');
        if (changeAvatarBtn && avatarInput) {
            changeAvatarBtn.addEventListener('click', () => {
                avatarInput.click();
            });

            avatarInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.previewProfileAvatar(e.target.files[0]);
                }
            });
        }

        const followersCount = document.getElementById('followersCount');
        const followingCount = document.getElementById('followingCount');
        const postsCount = document.getElementById('postsCount');

        if (followersCount) {
            followersCount.addEventListener('click', () => this.openFollowersModal());
        }
        if (followingCount) {
            followingCount.addEventListener('click', () => this.openFollowingModal());
        }
        if (postsCount) {
            postsCount.addEventListener('click', () => this.switchTab('posts'));
        }

        const postsTab = document.getElementById('postsTab');
        const savedTab = document.getElementById('savedTab');

        if (postsTab) {
            postsTab.addEventListener('click', () => this.switchTab('posts'));
        }
        if (savedTab) {
            if (this.profileUser.username === this.currentUser) {
                savedTab.style.display = 'flex';
                savedTab.addEventListener('click', () => this.switchTab('saved'));
            } else {
                savedTab.style.display = 'none';
            }
        }

        // Ensure posts tab is hidden if profile is locked and not following
        if (this.profileUser.isLocked && this.profileUser.username !== this.currentUser) {
            if (postsTab) postsTab.style.display = 'none';
        }

        this.addBackButton();
        this.setupModals();
        this.setupCommentsModal();
        this.setupLikesModal();
        this.setupMoreOptionsModal(); // This sets up the modal elements
        this.setupReportOptionsModal(); // New: Setup report options modal
        this.setupReportDescriptionModal(); // New: Setup report description modal
        this.updateMoreOptionsModalDisplay(); // Call it here to ensure initial state is correct after modal setup, relying on this.profileUser.isLocked
    }

    setupReportOptionsModal() {
        //.log('Setting up report options modal...');
        const modal = document.getElementById('report-options-modal');
        const closeBtn = modal?.querySelector('.close-report-options-modal');
        const optionsContainer = modal?.querySelector('.report-options-list');

        if (!modal || !closeBtn || !optionsContainer) {
            //.warn('Report options modal elements not found');
            return;
        }

        const closeModal = () => {
            this.closeModal('report-options-modal');
            this.reportTargetId = null;
            this.reportType = null;
            optionsContainer.innerHTML = ''; // Clear options on close
        };

        closeBtn.addEventListener('click', closeModal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    async openReportOptionsModal(author, postId, event) {
        if (!event) {
            //.warn('openReportOptionsModal called without an event, blocking to prevent opening on page load.');
            return;
        }
        //.log('Opening report options modal for:', {
        //     author,
        //     postId
        // });
        const modal = document.getElementById('report-options-modal');
        const optionsContainer = modal?.querySelector('.report-options-list'); // Corrected to .report-options-list

        if (!modal || !optionsContainer) {
            //.error('Report options modal or container not found!');
            return;
        }

        optionsContainer.innerHTML = ''; // Clear previous options

        const isOwner = event.target.closest('.post-menu-btn')?.getAttribute('data-post-owner') === 'true';

        if (isOwner) {
            const deletePostBtn = document.createElement('button');
            deletePostBtn.id = 'delete-post-option';
            deletePostBtn.textContent = 'Delete this post';
            deletePostBtn.classList.add('modal-option-btn', 'delete-option'); // Add a class for styling
            deletePostBtn.addEventListener('click', async () => {
                if (postId && await this.showConfirmation('Do you want to delete this post?')) {
                    await this.deletePost(postId);
                    modal.classList.remove('active');
                    window.location.reload(); // Refresh the page after deletion
                }
            });
            optionsContainer.appendChild(deletePostBtn);
        }

        // Option 1: Report this post (only if not owner)
        if (!isOwner) {
            const reportPostBtn = document.createElement('button');
            reportPostBtn.id = 'report-post-option';
            reportPostBtn.textContent = 'Report this post';
            reportPostBtn.classList.add('modal-option-btn');
            reportPostBtn.addEventListener('click', () => {
                this.reportTargetId = postId;
                this.reportType = 'post';
                this.openReportDescriptionModal(this.reportTargetId, this.reportType);
                this.closeModal('report-options-modal');
            });
            optionsContainer.appendChild(reportPostBtn);

            // Option 2: Report this account (only if not owner)
            const reportUserBtn = document.createElement('button');
            reportUserBtn.id = 'report-user-option';
            reportUserBtn.textContent = 'Report this account';
            reportUserBtn.classList.add('modal-option-btn');
            reportUserBtn.addEventListener('click', () => {
                this.reportTargetId = author; // Target is the username for user report
                this.reportType = 'user';
                this.openReportDescriptionModal(this.reportTargetId, this.reportType);
                this.closeModal('report-options-modal');
            });
            optionsContainer.appendChild(reportUserBtn);
        }

        this.openModal('report-options-modal');
    }

    setupReportDescriptionModal() {
        //.log('Setting up report description modal...');
        const modal = document.getElementById('report-description-modal');
        const closeBtn = modal?.querySelector('.close-report-description-modal');
        const submitReportBtn = modal?.querySelector('#submit-report-btn');
        const reportDescriptionInput = modal?.querySelector('#report-description-input');
        const reportOptionsContainer = modal?.querySelector('.report-description-options'); // New container for options
        const otherDescriptionContainer = modal?.querySelector('.other-description-container'); // Container for 'Other' input

        if (!modal || !closeBtn || !submitReportBtn || !reportDescriptionInput || !reportOptionsContainer || !otherDescriptionContainer) {
            //.warn('Report description modal elements not found');
            return;
        }

        // Hide 'Other' description input by default
        otherDescriptionContainer.style.display = 'none';

        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            reportDescriptionInput.value = '';
            otherDescriptionContainer.style.display = 'none'; // Hide on close
            this.reportTargetId = null;
            this.reportType = null;
            reportOptionsContainer.innerHTML = ''; // Clear options on close
        });

        submitReportBtn.addEventListener('click', async () => {
            let description = '';
            const selectedOption = reportOptionsContainer.querySelector('input[name="report-reason"]:checked');

            if (selectedOption) {
                description = selectedOption.value;
                if (description === 'Other') {
                    description = reportDescriptionInput.value.trim();
                }
            } else {
                // If no radio button is selected, but 'Other' input is visible, use its value
                if (otherDescriptionContainer.style.display !== 'none') {
                    description = reportDescriptionInput.value.trim();
                }
            }

            if (description && this.reportTargetId && this.reportType) {
                await this.submitReport(this.reportTargetId, this.reportType, description);
                modal.style.display = 'none';
                reportDescriptionInput.value = '';
                otherDescriptionContainer.style.display = 'none';
                reportOptionsContainer.innerHTML = ''; // Clear options
            } else {
                this.showMessage('Please select a reason or provide a description for the report.');
            }
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                reportDescriptionInput.value = '';
                otherDescriptionContainer.style.display = 'none';
                this.reportTargetId = null;
                this.reportType = null;
                reportOptionsContainer.innerHTML = ''; // Clear options
            }
        });
    }

    openReportDescriptionModal(targetId, type) {
        //.log('Opening report description modal for:', { targetId, type });
        const modal = document.getElementById('report-description-modal');
        const reportOptionsContainer = modal?.querySelector('.report-description-options');
        const reportDescriptionInput = modal?.querySelector('#report-description-input');
        const otherDescriptionContainer = modal?.querySelector('.other-description-container');

        if (!modal || !reportOptionsContainer || !reportDescriptionInput || !otherDescriptionContainer) {
            //.error('Report description modal elements not found!');
            return;
        }

        this.reportTargetId = targetId;
        this.reportType = type;

        reportOptionsContainer.innerHTML = ''; // Clear previous options
        reportDescriptionInput.value = ''; // Clear previous input
        otherDescriptionContainer.style.display = 'none'; // Hide 'Other' input initially

        const reasons = ['Nudity', 'Verbal abuse', 'Scammer', 'Other'];

        reasons.forEach(reason => {
            const div = document.createElement('div');
            div.classList.add('report-reason-option');
            div.innerHTML = `
                <input type="radio" id="reason-${reason.toLowerCase().replace(/\s/g, '-')}" name="report-reason" value="${reason}">
                <label for="reason-${reason.toLowerCase().replace(/\s/g, '-')}" class="report-reason-label">${reason}</label>
            `;
            reportOptionsContainer.appendChild(div);
        });

        // Add event listener for radio buttons to show/hide 'Other' input
        reportOptionsContainer.addEventListener('change', (e) => {
            if (e.target.name === 'report-reason') {
                if (e.target.value === 'Other') {
                    otherDescriptionContainer.style.display = 'block';
                    reportDescriptionInput.focus();
                } else {
                    otherDescriptionContainer.style.display = 'none';
                }
            }
        });

        modal.classList.add('active');
    }

    async submitReport(targetId, type, description) {
        try {
            const endpoint = type === 'post' ? `/user/report-post/post-id=${targetId}` : `/user/report-user/user-name=${targetId}`;
            const body = { description: description.trim() };

            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`Failed to submit report: ${response.status}`);
            }

            this.showMessage('Report submitted successfully!', 'success');
        } catch (error) {
            //.error('Error submitting report:', error);
            this.showError('Failed to submit report. Please try again.');
        }
    }

    async deletePost(postId) {
        try {
            const response = await fetch(`${this.baseUrl}/user/delete-blog/${postId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                this.showError('Failed to delete post. Please try again.');
                throw new Error('Failed to delete post');}
            // Optionally, remove the post from the UI without full reload
            const postElement = document.querySelector(`.post[data-post-id="${postId}"]`);
            if (postElement) {
                postElement.remove();
                // Update post count
                const postsCountElement = document.querySelector('#postsCount .stat-number');
                if (postsCountElement) {
                    let count = parseInt(postsCountElement.textContent) || 0;
                    postsCountElement.textContent = Math.max(0, count - 1).toString();
                }
            }
            this.showMessage('Post deleted successfully!', 'success');
        } catch (error) {
            //.error('Error deleting post:', error);
            this.showError('Failed to delete post. Please try again.');
        }
    }

    setupLikesModal() {
        //.log('Setting up likes modal...');
        const modal = document.getElementById('likes-modal');
        const closeBtn = modal?.querySelector('.close-likes-modal');

        if (!modal) {
            //.warn('Likes modal not found');
            return;
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                modal.classList.remove('active');
                document.body.style.overflow = '';
            });
        }

        // Modal backdrop close
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                modal.classList.remove('active');
                document.body.style.overflow = '';
                //.log('Likes modal closed by backdrop click');
            }
        };

        // Prevent clicks inside modal content from closing modal
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.onclick = (e) => {
                e.stopPropagation();
            };
        }

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && (modal.style.display === 'block' || modal.classList.contains('active'))) {
                modal.style.display = 'none';
                modal.classList.remove('active');
                document.body.style.overflow = '';
                //.log('Likes modal closed by Escape key');
            }
        });
    }

    setupMoreOptionsModal() {
        const modal = document.getElementById('moreOptionsModal');
        const closeBtn = modal?.querySelector('.close-options-modal');
        const toggleProfilePrivacyOption = document.getElementById('toggleProfilePrivacy');
        const generateQrCodeOption = document.getElementById('generateQrCodeOption');
        const shareProfileOption = document.getElementById('shareProfileOption');
        const logoutOption = document.getElementById('logoutOption');

        if (!modal) {
            //.warn('More Options modal not found');
            return;
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal('moreOptionsModal');
            });
        }

        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeModal('moreOptionsModal');
            }
        };

        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.onclick = (e) => {
                e.stopPropagation();
            };
        }

        if (toggleProfilePrivacyOption) {
            toggleProfilePrivacyOption.addEventListener('click', async () => {
                if (this.profileUser && this.profileUser.username === this.currentUser) {
                    await this.toggleProfileLockStatus(!this.profileUser.isLocked);
                } else {
                    this.showMessage('You can only change the lock status for your own profile.', 'error');
                }
            });
        }

        if (generateQrCodeOption) {
            generateQrCodeOption.addEventListener('click', () => {
                this.showMessage('Generate QR Code functionality coming soon!', 'info');
                this.closeModal('moreOptionsModal');
            });
        }

        if (shareProfileOption) {
            shareProfileOption.addEventListener('click', () => {
                this.showMessage('Share Profile functionality coming soon!', 'info');
                this.closeModal('moreOptionsModal');
            });
        }

        if (logoutOption) {
            logoutOption.addEventListener('click', async () => {
                await this.logoutUser();
            });
        }
    }

    async toggleProfileLockStatus(lock) {
        //.log('toggleProfileLockStatus called with lock:', lock);
        //.log('profileUser.isLocked BEFORE API call:', this.profileUser.isLocked);

        if (!this.profileUser || this.profileUser.username !== this.currentUser) {
            this.showMessage('You can only change the lock status for your own profile.', 'error');
            return;
        }

        const endpoint = lock ? '/user/lock-profile' : '/user/unlock-profile';
        const actionText = lock ? 'Locking' : 'Making Public';
        const successText = lock ? 'Profile locked successfully!' : 'Profile made public successfully!';
        const errorText = lock ? 'Failed to lock profile.' : 'Failed to make profile public.';

        const toggleProfilePrivacyOption = document.getElementById('toggleProfilePrivacy');
        if (toggleProfilePrivacyOption) toggleProfilePrivacyOption.disabled = true;

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'PUT',
                credentials: 'include'
            });

            //.log(`toggleProfileLockStatus - API call to ${endpoint} responded with status: ${response.status} ${response.statusText}, ok: ${response.ok}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Update local state immediately after successful API call
            this.profileUser.isLocked = lock;
            this.loggedInUser.isLocked = lock; // Also update loggedInUser's isLocked status
            //.log('toggleProfileLockStatus - profileUser.isLocked AFTER local update:', this.profileUser.isLocked);

            // The UI will be updated based on the new local state.
            this.updateProfileDisplay(); // Refresh profile display (e.g., posts grid)
            this.updateMoreOptionsModalDisplay(); // Update options visibility based on fresh data
            this.showMessage(successText, 'success');
            this.closeModal('moreOptionsModal');
        } catch (error) {
            //.error(`Error ${actionText.toLowerCase()} profile:`, error);
            this.showError(errorText + ' Please try again.');
        } finally {
            if (toggleProfilePrivacyOption) toggleProfilePrivacyOption.disabled = false;
        }
    }

    async updateMoreOptionsModalDisplay() {
        //.log('updateMoreOptionsModalDisplay called. profileUser.isLocked:', this.profileUser.isLocked);
        const toggleProfilePrivacyOption = document.getElementById('toggleProfilePrivacy');

        if (toggleProfilePrivacyOption && this.profileUser && this.profileUser.username === this.currentUser) {
            const currentLockStatus = !!this.profileUser.isLocked; // Ensure it's always a boolean
            toggleProfilePrivacyOption.textContent = currentLockStatus ? 'Make Profile Public' : 'Make Profile Private';
            toggleProfilePrivacyOption.style.display = 'block';
        } else if (toggleProfilePrivacyOption) {
            toggleProfilePrivacyOption.style.display = 'none';
        }
    }

    async logoutUser() {
        try {
            document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
            window.location.href = "/login.html"; // or wherever you redirect

            
        } catch (error) {
            //.error('Error logging out:', error);
            this.showError('Failed to log out. Please try again.');
        }
    }

    setupModals() {
        const editModal = document.getElementById('editProfileModal');
        const saveBtn = document.getElementById('saveProfileBtn');
        const cropBtn = document.getElementById('crop-btn');
        const cancelCropBtn = document.getElementById('cancel-crop-btn');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveProfile());
        }

        if (cropBtn) {
            cropBtn.addEventListener('click', () => this.cropAndUpload());
        }

        if (cancelCropBtn) {
            cancelCropBtn.addEventListener('click', () => {
                this.closeModal('crop-modal');
                if (this.cropper) {
                    this.cropper.destroy();
                    this.cropper = null;
                }
            });
        }

        const followersModal = document.getElementById('followersModal');
        followersModal?.addEventListener('click', (e) => {
            if (e.target === followersModal) {
                this.closeModal('followersModal');
            }
        });

        const followingModal = document.getElementById('followingModal');
        followingModal?.addEventListener('click', (e) => {
            if (e.target === followingModal) {
                this.closeModal('followingModal');
            }
        });

        editModal?.addEventListener('click', (e) => {
            if (e.target === editModal) {
                this.closeModal('editProfileModal');
            }
        });
    }

    addBackButton() {
        const header = document.querySelector('.profile-header');
        if (header && !document.querySelector('.back-btn')) {
            const backBtn = document.createElement('button');
            backBtn.className = 'back-btn';
            backBtn.innerHTML = '←';
            backBtn.style.cssText = `
                  position: fixed;
                  top: 20px;
                  left: 20px;
                  z-index: 1000;
                  background: #0095f6;
                  color: white;
                  border: none;
                  padding: 12px 16px;
                  border-radius: 50%;
                  cursor: pointer;
                  font-size: 18px;
                  font-weight: bold;
                  width: 44px;
                  height: 44px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                  transition: background-color 0.2s ease;
              `;
            backBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
            backBtn.addEventListener('mouseenter', () => {
                backBtn.style.backgroundColor = '#0084d6';
            });
            backBtn.addEventListener('mouseleave', () => {
                backBtn.style.backgroundColor = '#0095f6';
            });
            document.body.prepend(backBtn);
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });

        const targetTab = document.getElementById(tabName + 'Tab');
        if (targetTab) {
            targetTab.classList.add('active');
        }

        this.currentTab = tabName;

        switch (tabName) {
            case 'posts':
                this.loadPosts();
                break;
            case 'saved':
                this.loadSavedPosts();
                break;
        }
    }

    async loadPosts() {
        const container = document.getElementById('postsGrid');
        const noPosts = document.getElementById('noPosts');

        container.style.display = 'grid';
        noPosts.style.display = 'none';
        container.innerHTML = '<div class="loading">Loading posts...</div>';

        try {
            const username = this.profileUser.username;
            let url;

            if (this.profileUser.username === this.currentUser) {
                url = `${this.baseUrl}/user`;
            } else {
                url = `${this.baseUrl}/user/get-user/username=${encodeURIComponent(username)}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include'
            });

            if (response.status === 423) {
                // This case handles when a user is viewing a locked profile they don't follow.
                //.log('Profile is locked. Not loading posts.');
                container.style.display = 'none';
                noPosts.style.display = 'block';
                noPosts.innerHTML = `
                    <i class="fas fa-lock"></i>
                    <h3>This Account is Private</h3>
                    <p>Follow this account to see their photos and videos.</p>
                `;
                return; // Exit the function gracefully
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const userData = await response.json();
            container.innerHTML = '';

            // If profile is locked and current user is not following, do not load posts
            if (this.profileUser.isLocked && this.profileUser.username !== this.currentUser) {
                const isFollowing = await this.checkIfUserFollowing(this.profileUser.username);
                if (!isFollowing) {
                    container.style.display = 'none';
                    noPosts.style.display = 'block';
                    noPosts.innerHTML = `
                        <i class="fas fa-lock"></i>
                        <h3>This Account is Private</h3>
                        <p>Follow this account to see their photos and videos.</p>
                    `;
                    return;
                }
            }

            if (userData.list && Array.isArray(userData.list) && userData.list.length > 0) {
                //.log('Found post IDs in user data:', userData.list);

                const postPromises = userData.list.map(async (postId) => {
                    try {
                        const postResponse = await fetch(`${this.baseUrl}/user/get-blog/${postId}`, {
                            method: 'GET',
                            credentials: 'include'
                        });

                        if (postResponse.ok) {
                            return await postResponse.json();
                        }
                        return null;
                    } catch (error) {
                        //.warn(`Failed to fetch post ${postId}:`, error);
                        return null;
                    }
                });

                const posts = (await Promise.all(postPromises)).filter(post => post !== null);

                if (posts.length === 0) {
                    container.style.display = 'none';
                    noPosts.style.display = 'block';
                    return;
                }

                this.allPosts = posts;

                for (const post of posts) {
                    await this.renderPostThumbnail(post, container);
                }

                return;
            }

            const posts = userData.posts || (Array.isArray(userData) ? userData : []);

            if (!posts || posts.length === 0) {
                container.style.display = 'none';
                noPosts.style.display = 'block';
                return;
            }

            this.allPosts = posts;

            for (const post of posts) {
                await this.renderPostThumbnail(post, container);
            }

        } catch (error) {
            //.error('Error loading posts:', error);
            container.innerHTML = '<div class="no-posts">Failed to load posts</div>';
        }
    }

    async loadSavedPosts() {
        const container = document.getElementById('postsGrid');
        const noPosts = document.getElementById('noPosts');

        container.style.display = 'grid';
        noPosts.style.display = 'none';
        container.innerHTML = '<div class="loading">Loading saved posts...</div>';

        try {
            const response = await fetch(`${this.baseUrl}/user/saved-posts`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const savedPosts = await response.json();
            container.innerHTML = '';

            if (!savedPosts || savedPosts.length === 0) {
                container.style.display = 'none';
                noPosts.style.display = 'block';
                return;
            }

            const uniquePosts = savedPosts.filter((post, index, self) =>
                index === self.findIndex((p) => (
                    p.stringID === post.stringID
                ))
            );


            for (const post of uniquePosts) {
                await this.renderPostThumbnail(post, container);
            }

        } catch (error) {
            //.error('Error loading saved posts:', error);
            container.innerHTML = '<div class="no-posts">Failed to load saved posts</div>';
        }
    }

    async renderPostThumbnail(post, container) {
        const postElement = document.createElement('div');
        postElement.className = 'post';
        postElement.setAttribute('data-post-id', post.stringID);

        // Fetch all image URLs for the post, similar to main.js
        if (Array.isArray(post.fileID)) {
            post.imageUrls = await Promise.all(post.fileID.map(async fileObj => {
                // If fileObj is an object, get its stringID (or id)
                let id = '';
                if (typeof fileObj === 'object' && fileObj !== null) {
                    id = fileObj.stringID || fileObj.id || '';
                } else {
                    id = fileObj;
                }
                if (!id) {
                    //.error('Invalid file object:', fileObj);
                    return null;
                }
                const fileRes = await fetch(`${this.baseUrl}/files/get-files/file-id=${id}`, {
                    credentials: 'include'
                });
                if (!fileRes.ok) {
                    //.error(`Failed to fetch file for id: ${id}`);
                    return null;
                }
                const blob = await fileRes.blob();
                return URL.createObjectURL(blob);
            }));
        } else {
            post.imageUrls = [];
        }

        // Use first image as thumbnail
        let thumbnailUrl = this.profileUserAvatar;
        if (post.imageUrls && post.imageUrls.length > 0 && post.imageUrls[0]) {
            thumbnailUrl = post.imageUrls[0];
        }

        const [likesList, commentsList] = await Promise.all([
            this.fetchBlogLikes(post.stringID),
            this.fetchBlogComments(post.stringID)
        ]);

        postElement.innerHTML = `
              <img src="${thumbnailUrl}" alt="Post" loading="lazy">
              <div class="post-overlay">
                  <div class="overlay-stat">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                      </svg>
                      <span>${likesList.length}</span>
                  </div>
                  <div class="overlay-stat">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      <span>${commentsList.filter(c => c && c.comment && c.comment.trim()).length}</span>
                  </div>
              </div>
          `;

        postElement.addEventListener('click', () => {
            //.log('Post clicked:', post);
            this.openPostViewer(post);
        });

        container.appendChild(postElement);
    }

    async fetchBlogLikes(postId) {
        try {
            const response = await fetch(`${this.baseUrl}/user/blog-likes/${postId}`, {
                credentials: 'include'
            });
            return response.ok ? await response.json() : [];
        } catch (error) {
            //.warn('Failed to fetch likes:', error);
            return [];
        }
    }

    async fetchBlogComments(postId) {
        try {
            const response = await fetch(`${this.baseUrl}/user/get-all-comments/blog-id=${postId}`, {
                credentials: 'include'
            });
            return response.ok ? await response.json() : [];
        } catch (error) {
            //.warn('Failed to fetch comments:', error);
            return [];
        }
    }

    async openPostViewer(clickedPost) {
        //.log('Opening post viewer for:', clickedPost);
        try {
            this.currentPostIndex = this.allPosts.findIndex(post => post.stringID === clickedPost.stringID);
            if (this.currentPostIndex === -1) {
                this.currentPostIndex = 0;
            }

            await this.showPostModal(clickedPost);
        } catch (error) {
            //.error('Error in openPostViewer:', error);
            this.showMessage('Failed to open post: ' + error.message);
        }
    }

    async openProfilePictureViewer() {
        // Fetch stories specifically for the profile user
        await this.fetchAllStories(this.profileUser.username);

        // After fetching, this.stories will contain the stories for profileUser.username
        const userStoryGroup = this.stories.find(group => group.author === this.profileUser.username);
        const hasStories = userStoryGroup && userStoryGroup.stories && userStoryGroup.stories.length > 0;

        if (hasStories) {
            // If stories exist for the profile user, open the story modal for them.
            this.openStoryModal(this.profileUser.username);
        } else if (this.profileUser.username === this.currentUser) {
            // If no stories exist AND it's the current user's profile, open the create story modal.
            this.openCreatePostModalForStory();
        }
        // If it's another user's profile and they have no stories, nothing happens, which is correct.
    }
    async openStoryModal(authorUsername = null) {
        const storyModal = document.getElementById('storyModal');
        if (!storyModal) {
            //.error('Story modal element not found.');
            return;
        }
        storyModal.style.display = 'flex';
        // Ensure the viewers modal is hidden when the main story modal opens
        const storyViewersModal = document.getElementById('storyViewersModal');
        if (storyViewersModal) {
            storyViewersModal.classList.remove('active');
            storyViewersModal.style.display = 'none';
        }
        this.allStories = this.stories || [];
        let authorStoryGroupIndex = -1;

        if (authorUsername) {
            authorStoryGroupIndex = this.allStories.findIndex(group => group.author === authorUsername);
        }

        if (authorStoryGroupIndex !== -1) {
            this.currentStoryIndex = authorStoryGroupIndex;
            this.allStories[this.currentStoryIndex].currentStory = 0; // Initialize sub-story index
        } else {
            this.currentStoryIndex = 0; // Default to the first group if author not found or not provided
            if (this.allStories.length > 0) {
                this.allStories[this.currentStoryIndex].currentStory = 0; // Initialize sub-story index
            }
        }

        this.renderStoryModalContent();
    }

   
    openEditProfile() {
        const bioInput = document.getElementById('editBio');
        const linksInput = document.getElementById('editLinks');
        const avatarImg = document.getElementById('editProfileAvatar');

        if (bioInput) bioInput.value = this.profileUser.bio || '';
        if (linksInput) {
            const linksArray = this.profileUser.links ?
                (Array.isArray(this.profileUser.links) ? this.profileUser.links : Array.from(this.profileUser.links)) :
                [];
            linksInput.value = linksArray.join('\n');
        }
        if (avatarImg) {
            avatarImg.src = this.profileUserAvatar;
        }

        this.openModal('editProfileModal');
    }

    previewProfileAvatar(file) {
        this.isCroppingForStory = false;
        this.selectedAvatarFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            const image = document.getElementById('image-to-crop');
            image.src = e.target.result;
            this.openModal('crop-modal');
            if (this.cropper) {
                this.cropper.destroy();
            }
            this.cropper = new Cropper(image, {
                viewMode: 1,
                autoCropArea: 0.5,
                movable: true,
                zoomable: true,
                rotatable: true,
                scalable: true,
            });
        };
        reader.readAsDataURL(file);
    }

    async cropAndUpload() {
        if (!this.cropper) {
            this.showError('Cropper not initialized.');
            this.closeModal('crop-modal');
            return;
        }
    
        if (this.isCroppingForStory) {
            const canvas = this.cropper.getCroppedCanvas({
                width: 1200,
                height: 1200,
                imageSmoothingQuality: 'high',
            });
    
            canvas.toBlob((blob) => {
                const file = new File([blob], `cropped_${this.croppedFiles.length}.jpg`, { type: 'image/jpeg' });
                this.croppedFiles.push(file);
                this.showCropperForNextFile();
            }, 'image/jpeg');
        } else { // Assuming avatar cropping
            if (!this.selectedAvatarFile) {
                this.showError('No file selected to crop.');
                this.closeModal('crop-modal');
                return;
            }
            const canvas = this.cropper.getCroppedCanvas({
                width: 512,
                height: 512,
                minWidth: 256,
                minHeight: 256,
                maxWidth: 4096,
                maxHeight: 4096,
                fillColor: '#fff',
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high',
            });
    
            canvas.toBlob(async (blob) => {
                const croppedFile = new File([blob], this.selectedAvatarFile.name, {
                    type: blob.type,
                    lastModified: Date.now()
                });
    
                try {
                    await this.uploadProfileAvatar(croppedFile);
                    this.closeModal('crop-modal');
                    if (this.cropper) {
                        this.cropper.destroy();
                        this.cropper = null;
                    }
                    const editAvatar = document.getElementById('editProfileAvatar');
                    if (editAvatar) {
                        editAvatar.src = URL.createObjectURL(croppedFile);
                    }
                } catch (error) {
                    //.error('Error uploading cropped avatar:', error);
                    this.showError('Failed to upload cropped avatar.');
                }
            }, 'image/jpeg', 0.9);
        }
    }

    async showConfirmation(message) {
        return new Promise((resolve) => {
            const confirmationBox = document.getElementById('confirmation-box');
            const messageElement = confirmationBox.querySelector('.confirmation-message');
            const okButton = document.getElementById('confirm-ok-btn');
            const cancelButton = document.getElementById('confirm-cancel-btn');
            const backdrop = confirmationBox; // The whole box acts as the backdrop

            // Set the message
            messageElement.textContent = message;

            // Function to close the confirmation box
            const closeConfirmation = (result) => {
                confirmationBox.classList.remove('active');
                document.body.style.overflow = ''; // Re-enable background scrolling

                // Remove event listeners to prevent memory leaks
                okButton.removeEventListener('click', handleOk);
                cancelButton.removeEventListener('click', handleCancel);
                backdrop.removeEventListener('click', handleBackdropClick);

                resolve(result);
            };

            // Event handler for OK button
            const handleOk = () => {
                closeConfirmation(true);
            };

            // Event handler for Cancel button or backdrop click
            const handleCancel = () => {
                closeConfirmation(false);
            };

            // Event handler for clicking the backdrop (outside the content)
            const handleBackdropClick = (event) => {
                if (event.target === confirmationBox) { // Check if click is directly on the backdrop
                    closeConfirmation(false);
                }
            };

            // Attach event listeners
            okButton.addEventListener('click', handleOk);
            cancelButton.addEventListener('click', handleCancel);
            backdrop.addEventListener('click', handleBackdropClick);

            // Show the confirmation box
            confirmationBox.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        });
    }

    async saveProfile() {
        const bioInput = document.getElementById('editBio');
        const linksInput = document.getElementById('editLinks');
        const saveBtn = document.getElementById('saveProfileBtn');

        if (!bioInput || !linksInput) return;

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            const linksArray = linksInput.value.trim()
                ? linksInput.value.trim().split('\n').map(link => {
                    let trimmedLink = link.trim();
                    if (trimmedLink.length > 0 && !/^(https?:\/\/|mailto:|tel:)/i.test(trimmedLink)) {
                        return `https://${trimmedLink}`;
                    }
                    return trimmedLink;
                }).filter(link => link.length > 0)
                : [];
            const linksList = [...new Set(linksArray)];
            //.log('Sending profile update:', {
             

            const bioResponse = await fetch(`${this.baseUrl}/user/edit-bio`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bio: bioInput.value }) // Send bio as JSON object
            });

            //.log('Bio update response status:', bioResponse.status);
            if (!bioResponse.ok) {
                const bioError = await bioResponse.text();
                throw new Error(`Failed to update bio: ${bioResponse.status} - ${bioError}`);
            }

            const linksResponse = await fetch(`${this.baseUrl}/user/edit-links`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(linksList)
            });

            //.log('Links update response status:', linksResponse.status);
            if (!linksResponse.ok) {
                const linksError = await linksResponse.text();
                throw new Error(`Failed to update links: ${linksResponse.status} - ${linksError}`);
            }

            //.log('Profile update completed successfully');
            this.profileUser.bio = bioInput.value.trim();
            this.profileUser.links = linksList;

            this.selectedAvatarFile = null;

            this.updateProfileDisplay();
            this.closeModal('editProfileModal');

            await this.loadOwnProfile();
            this.showMessage('Profile updated successfully!', 'success');
        } catch (error) {
            //.error('Error saving profile:', error);
            this.showMessage('Failed to update profile. Please try again.');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    }

    async uploadProfileAvatar(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const uploadResponse = await fetch(`${this.baseUrl}/files/upload-files`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error('Failed to upload file');
            }

            const fileData = await uploadResponse.json();
            const fileId = fileData.stringID;

            const avatarResponse = await fetch(`${this.baseUrl}/user/update-avatar/file-id=${fileId}`, {
                method: 'PUT',
                credentials: 'include'
            });

            if (!avatarResponse.ok) {
                this.showError('Failed to update avatar. Please try again.');
                throw new Error('Failed to update avatar');
            }

            const newAvatarUrl = URL.createObjectURL(file);
            this.profileUserAvatar = newAvatarUrl;

            const profilePic = document.getElementById('profilePic');
            if (profilePic) profilePic.src = newAvatarUrl;

            this.profileUser.profileAvatarID = fileId;

        } catch (error) {
            //.error('Error uploading avatar:', error);
            throw error;
        }
    }

    // Asynchronously checks if a user is following another user
    async checkIfUserFollowing(username) {
        // Try to fetch the data from the API
        try {
            // Fetch the data from the API
            const response = await fetch(`${this.baseUrl}/user/check-following/username=${encodeURIComponent(username)}`, {
                credentials: 'include'
            });
            // If the response is ok, return the json data
            if (response.ok) {
                return await response.json();
            }
            return false;
        } catch (error) {
            //.error('Error checking if user is following:', error);
            // If there is an error, log the error and return false
            return false;
        }
    }

    async toggleFollow() {
        const isFollowing = await this.checkIfUserFollowing(this.profileUser.username);
        const action = isFollowing ? 'unfollow' : 'follow';
        const method = isFollowing ? 'DELETE' : 'POST';
        const successMessage = isFollowing ? 'Unfollowed successfully!' : 'Followed successfully!';
        const errorMessage = isFollowing ? 'Failed to unfollow.' : 'Failed to follow.';

        try {
            const response = await fetch(`${this.baseUrl}/user/${action}-user/user-id=${this.profileUser.stringID}`, {
                method: method,
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Optimistic UI Update
            if (isFollowing) {
                this.profileUser.numberOfFollower = (this.profileUser.numberOfFollower || 1) - 1;
                if (this.loggedInUser && this.loggedInUser.following) {
                    this.loggedInUser.following = this.loggedInUser.following.filter(f => f !== this.profileUser.username);
                }
            } else {
                this.profileUser.numberOfFollower = (this.profileUser.numberOfFollower || 0) + 1;
                if (this.loggedInUser && this.loggedInUser.following) {
                    this.loggedInUser.following.push(this.profileUser.username);
                }
            }

            this.showMessage(successMessage, 'success');
            this.updateProfileDisplay(); // Re-render the UI with the new state

        } catch (error) {
            //.error(`Error toggling follow status:`, error);
            this.showError(errorMessage + ' Please try again.');
        }
    }

    async toggleFollowRequest() {
        const isRequestSent = await this.checkIfFollowRequestSent(this.profileUser.username);
        const action = isRequestSent ? 'remove-request' : 'follow-request';
        const method = isRequestSent ? 'DELETE' : 'POST';
        const successMessage = isRequestSent ? 'Follow request cancelled!' : 'Follow request sent!';
        const errorMessage = isRequestSent ? 'Failed to cancel request.' : 'Failed to send request.';

        try {
            const response = await fetch(`${this.baseUrl}/user/${action}/username=${encodeURIComponent(this.profileUser.username)}`, {
                method: method,
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Update local state for immediate UI feedback
            if (isRequestSent) {
                // We just cancelled the request
                const index = this.loggedInUser.sentRequests.indexOf(this.profileUser.username);
                if (index > -1) {
                    this.loggedInUser.sentRequests.splice(index, 1);
                }
            } else {
                // We just sent a request
                if (!this.loggedInUser.sentRequests) {
                    this.loggedInUser.sentRequests = [];
                }
                this.loggedInUser.sentRequests.push(this.profileUser.username);
            }

            this.showMessage(successMessage, 'success');
            // await this.loadOwnProfile(); // Refresh logged-in user's sent requests
            this.updateProfileDisplay(); // Update UI
        } catch (error) {
            //.error(`Error toggling follow request status:`, error);
            this.showError(errorMessage + ' Please try again.');
        }
    }

    async openFollowRequestsModal() {
        const modal = document.getElementById('followRequestsModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal('followRequestsModal');
                }
            });
        }
        this.openModal('followRequestsModal');
        await this.loadFollowRequests();
    }

    async loadFollowRequests() {
        const container = document.querySelector('.follow-requests-container');
        if (!container) return;

        container.innerHTML = '<div class="loading">Loading follow requests...</div>';

        try {
            // Assuming receivedRequests is part of the loggedInUser object
            const receivedRequests = this.loggedInUser.receivedRequests || [];
            container.innerHTML = '';

            if (receivedRequests.length === 0) {
                container.innerHTML = '<div class="no-likes">No follow requests.</div>';
                return;
            }

            for (const requestUsername of receivedRequests) {
                await this.renderFollowRequest(requestUsername, container);
            }
        } catch (error) {
            //.error('Error loading follow requests:', error);
            container.innerHTML = '<div class="error">Failed to load follow requests</div>';
        }
    }

    async renderFollowRequest(username, container) {
        try {
            let avatarUrl = '1.png';

            try {
                const userResponse = await fetch(`${this.baseUrl}/user/get-user/username=${encodeURIComponent(username)}`, {
                    method: 'GET',
                    credentials: 'include'
                });

                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    if (userData.profileAvatarID) {
                        const avatarResponse = await fetch(`${this.baseUrl}/files/get-files/file-id=${userData.profileAvatarID}`, {
                            credentials: 'include'
                        });
                        if (avatarResponse.ok) {
                            const blob = await avatarResponse.blob();
                            avatarUrl = URL.createObjectURL(blob);
                        }
                    }
                }
            } catch (e) {
                //.warn('Failed to load avatar for user:', username, e);
            }

            const requestElement = document.createElement('div');
            requestElement.className = 'follow-request-item';
            requestElement.innerHTML = `
                <img src="${avatarUrl}" class="like-user-avatar" alt="${username}">
                <div class="user-info-section">
                    <span class="follow-request-username">${username}</span>
                </div>
                <button class="accept-request-btn">Accept</button>
                <button class="reject-request-btn">Reject</button>
            `;

            container.prepend(requestElement);

            const usernameSpan = requestElement.querySelector('.follow-request-username');
            if (usernameSpan) {
                usernameSpan.addEventListener('click', () => {
                    window.location.href = `profile.html?username=${encodeURIComponent(username)}`;
                });
            }

            const acceptBtn = requestElement.querySelector('.accept-request-btn');
            if (acceptBtn) {
                acceptBtn.addEventListener('click', async () => {
                    await this.acceptFollowRequest(username, requestElement);
                });
            }

            const rejectBtn = requestElement.querySelector('.reject-request-btn');
            if (rejectBtn) {
                rejectBtn.addEventListener('click', async () => {
                    await this.rejectFollowRequest(username, requestElement);
                });
            }

        } catch (error) {
            //.error('Error rendering follow request:', error);
        }
    }

    async acceptFollowRequest(username, requestElement) {
        try {
            const acceptBtn = requestElement.querySelector('.accept-request-btn');
            const rejectBtn = requestElement.querySelector('.reject-request-btn');
            if (acceptBtn) {
                acceptBtn.disabled = true;
                acceptBtn.textContent = 'Accepting...';
            }
            if (rejectBtn) rejectBtn.disabled = true;

            const response = await fetch(`${this.baseUrl}/user/accept-request/username=${encodeURIComponent(username)}`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                requestElement.remove();
                this.showMessage(`Accepted follow request from ${username}`, 'success');
                // Update local data
                if (this.loggedInUser.receivedRequests) {
                    this.loggedInUser.receivedRequests = this.loggedInUser.receivedRequests.filter(req => req !== username);
                }
                // Optionally refresh followers count
                await this.loadOwnProfile();
                this.updateProfileDisplay();
                this.updateFollowRequestsDot(); // Update dot after accepting
            } else {
                throw new Error('Failed to accept follow request');
            }
        } catch (error) {
            //.error('Error accepting follow request:', error);
            this.showError('Failed to accept follow request. Please try again.');
            if (acceptBtn) {
                acceptBtn.disabled = false;
                acceptBtn.textContent = 'Accept';
            }
            if (rejectBtn) rejectBtn.disabled = false;
        }
    }

    async rejectFollowRequest(username, requestElement) {
        try {
            const acceptBtn = requestElement.querySelector('.accept-request-btn');
            const rejectBtn = requestElement.querySelector('.reject-request-btn');
            if (rejectBtn) {
                rejectBtn.disabled = true;
                rejectBtn.textContent = 'Rejecting...';
            }
            if (acceptBtn) acceptBtn.disabled = true;

            const response = await fetch(`${this.baseUrl}/user/reject-request/username=${encodeURIComponent(username)}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                requestElement.remove();
                this.showMessage(`Rejected follow request from ${username}`, 'success');
                // Update local data
                if (this.loggedInUser.receivedRequests) {
                    this.loggedInUser.receivedRequests = this.loggedInUser.receivedRequests.filter(req => req !== username);
                }
                this.updateFollowRequestsDot(); // Update dot after rejecting
            } else {
                throw new Error('Failed to reject follow request');
            }
        } catch (error) {
            //.error('Error rejecting follow request:', error);
            this.showError('Failed to reject follow request. Please try again.');
            if (rejectBtn) {
                rejectBtn.disabled = false;
                rejectBtn.textContent = 'Reject';
            }
            if (acceptBtn) acceptBtn.disabled = false;
        }
    }

    async openFollowersModal() {
        this.openModal('followersModal');
        await this.loadFollowers();
    }

    async openFollowingModal() {
        this.openModal('followingModal');
        await this.loadFollowing();
    }

    async loadFollowers() {
        const container = document.querySelector('.followers-container');
        if (!container) return;

        container.innerHTML = '<div class="loading">Loading followers...</div>';

        try {
            const followers = this.profileUser.followers || [];
            container.innerHTML = '';

            if (followers.length === 0) {
                container.innerHTML = '<div class="no-likes">No followers yet</div>';
                return;
            }

            for (const followerUsername of followers) {
                await this.renderUserInModal(followerUsername, container);
            }
        } catch (error) {
            //.error('Error loading followers:', error);
            container.innerHTML = '<div class="error">Failed to load followers</div>';
        }
    }

    async loadFollowing() {
        const container = document.querySelector('.following-container');
        if (!container) return;

        container.innerHTML = '<div class="loading">Loading following...</div>';

        try {
            const following = this.profileUser.following || [];
            container.innerHTML = '';

            if (following.length === 0) {
                container.innerHTML = '<div class="no-likes">Not following anyone yet</div>';
                return;
            }

            for (const followingUsername of following) {
                await this.renderUserInModal(followingUsername, container);
            }
        } catch (error) {
            //.error('Error loading following:', error);
            container.innerHTML = '<div class="error">Failed to load following</div>';
        }
    }


    async renderUserInModal(username, container) {
        try {
            let avatarUrl = '1.png';

            try {
                const userResponse = await fetch(`${this.baseUrl}/user/get-user/username=${encodeURIComponent(username)}`, {
                    method: 'GET',
                    credentials: 'include'
                });

                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    if (userData.profileAvatarID) {
                        const avatarResponse = await fetch(`${this.baseUrl}/files/get-files/file-id=${userData.profileAvatarID}`, {
                            credentials: 'include'
                        });
                        if (avatarResponse.ok) {
                            const blob = await avatarResponse.blob();
                            avatarUrl = URL.createObjectURL(blob);
                        }
                    }
                }
            } catch (e) {
                //.warn('Failed to load avatar for user:', username, e);
            }

            const isFollowersModal = container.classList.contains('followers-container');
            const isOwnProfile = this.profileUser.username === this.currentUser;
            const showRemoveBtn = isFollowersModal && isOwnProfile;

            const userElement = document.createElement('div');
            userElement.className = 'like-user-item';
            userElement.innerHTML = `
                  <img src="${avatarUrl}" class="like-user-avatar" alt="${username}">
                  <div class="user-info-section">
                      <span class="like-username">${username}</span>
                  </div>
                  ${showRemoveBtn ? '<button class="remove-follower-btn">Remove</button>' : ''}
              `;

            container.prepend(userElement);

            const usernameSpan = userElement.querySelector('.like-username');
            if (usernameSpan) {
                usernameSpan.addEventListener('click', () => {
                    window.location.href = `profile.html?username=${encodeURIComponent(username)}`;
                });
            }

            if (showRemoveBtn) {
                const removeBtn = userElement.querySelector('.remove-follower-btn');
                if (removeBtn) {
                    removeBtn.addEventListener('click', async () => {
                        await this.removeFollower(username, userElement);
                    });
                }
            }

        } catch (error) {
            //.error('Error rendering user:', error);
        }
    }

    async removeFollower(username, userElement) {
        try {
            const removeBtn = userElement.querySelector('.remove-follower-btn');
            if (removeBtn) {
                removeBtn.disabled = true;
                removeBtn.textContent = 'Removing...';
            }

            const userResponse = await fetch(`${this.baseUrl}/user/get-user/username=${encodeURIComponent(username)}`, {
                method: 'GET',
                credentials: 'include'
            });

          
            const userData = await userResponse.json();

            const response = await fetch(`${this.baseUrl}/user/remove-follower/user-id=${userData.stringID}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                userElement.remove();

                const followersCountElement = document.querySelector('#followersCount .stat-number');
                if (followersCountElement) {
                    let count = parseInt(followersCountElement.textContent) || 0;
                    count = Math.max(0, count - 1);
                    followersCountElement.textContent = count.toString();
                }

                if (this.profileUser.followers) {
                    this.profileUser.followers = this.profileUser.followers.filter(f => f !== username);
                }
            } else {
                this.showError('Failed to remove follower. Please try again.');
                throw new Error('Failed to remove follower');
            }
        } catch (error) {
            //.error('Error removing follower:', error);
            this.showMessage('Failed to remove follower. Please try again.');

            const removeBtn = userElement.querySelector('.remove-follower-btn');
            if (removeBtn) {
                removeBtn.disabled = false;
                removeBtn.textContent = 'Remove';
            }
        }
    }

    // Show message (error or success)
    async showMessage(message, type = 'error') {
        const errorModal = document.getElementById('errorModal');
        const successModal = document.getElementById('successModal');

        let modalToShow;
        let messageElement;
        let headerElement;
        let iconElement;
        let closeBtn;
        let okBtn;

        if (type === 'success') {
            modalToShow = successModal;
            messageElement = successModal.querySelector('#successModalMessage');
            headerElement = successModal.querySelector('.success-modal-header h3');
            iconElement = successModal.querySelector('.success-icon svg');
            closeBtn = successModal.querySelector('.success-close-btn');
            okBtn = successModal.querySelector('.success-btn');
        } else {
            modalToShow = errorModal;
            messageElement = errorModal.querySelector('#errorModalMessage');
            headerElement = errorModal.querySelector('.error-modal-header h3');
            iconElement = errorModal.querySelector('.error-icon svg');
            closeBtn = errorModal.querySelector('.error-close-btn');
            okBtn = errorModal.querySelector('.error-btn');
        }

        messageElement.textContent = message;

        if (type === 'success') {
            headerElement.textContent = 'Success';
            iconElement.innerHTML = `
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            `;
        } else {
            headerElement.textContent = 'Error';
            iconElement.innerHTML = `
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            `;
        }

        modalToShow.classList.add('active');
        document.body.style.overflow = 'hidden';

        const closeModal = () => {
            modalToShow.classList.remove('active');
            document.body.style.overflow = '';
        };

        // Remove existing listeners to prevent duplicates
        const oldCloseBtn = closeBtn.cloneNode(true);
        const oldOkBtn = okBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(oldCloseBtn, closeBtn);
        okBtn.parentNode.replaceChild(oldOkBtn, okBtn);

        oldCloseBtn.onclick = closeModal;
        oldOkBtn.onclick = closeModal;
        modalToShow.onclick = (e) => {
            if (e.target === modalToShow) {
                closeModal();
            }
        };
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    handleError(message) {
        //.error(message);
        const container = document.querySelector('.profile-container');
        if (container) {
            container.innerHTML = `
                  <div style="text-align: center; padding: 60px 20px; color: #8e8e8e;">
                      <h3>${message}</h3>
                      <button onclick="window.location.href='index.html'" style="margin-top: 20px; background: #0095f6; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;">
                          Back to Home
                      </button>
                  </div>
              `;
        }
    }

    async showLikesModal(postId) {
        //.log('Showing likes for post:', postId);
        const modal = document.getElementById('likes-modal');
        if (!modal) {
            //.error('Likes modal not found');
            return;
        }

        // Show modal
        modal.style.display = 'block';
        modal.style.zIndex = '2002';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        await this.renderLikesModal(postId);
    }

    async renderLikesModal(postId) {
        //.log('Rendering likes for post:', postId);
        const likesContainer = document.querySelector('.likes-container');
        if (!likesContainer) {
            //.error('Likes container not found');
            return;
        }

        // Show loading state
        likesContainer.innerHTML = '<div class="loading">Loading likes...</div>';

        try {
            // Fetch users who liked the post
            const response = await fetch(`${this.baseUrl}/user/get-all-users/blog-id=${postId}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const usersMap = await response.json();
            //.log('Users who liked:', usersMap);

            // Clear container
            likesContainer.innerHTML = '';

            if (!usersMap || Object.keys(usersMap).length === 0) {
                likesContainer.innerHTML = '<div class="no-likes">No likes yet.</div>';
                return;
            }

            // Render each user who liked
            for (const [username, profileAvatarID] of Object.entries(usersMap)) {
                await this.renderLikeUser(username, profileAvatarID, likesContainer);
            }

        } catch (error) {
            //.error('Failed to fetch likes:', error);
            likesContainer.innerHTML = '<div class="error">Failed to load likes</div>';
        }
    }

    async renderLikeUser(username, profileAvatarID, container) {
        try {
            // Fetch user profile to get avatar
            let avatarUrl = '1.png';

            if (profileAvatarID) {
                try {
                    const userResponse = await fetch(`${this.baseUrl}/user/get-user/username=${encodeURIComponent(username)}`, {
                        method: 'GET',
                        credentials: 'include'
                    });

                    if (userResponse.ok) {
                        const userData = await userResponse.json();
                        //.log('User data:', userData);
                        if (userData.profileAvatarID) {
                            const avatarResponse = await fetch(`${this.baseUrl}/files/get-files/file-id=${userData.profileAvatarID}`, {
                                credentials: 'include'
                            });
                            if (avatarResponse.ok) {
                                const blob = await avatarResponse.blob();
                                avatarUrl = URL.createObjectURL(blob);

                            }
                        }
                    }
                } catch (e) {
                    //.warn('Failed to load avatar for user:', username, e);
                }
            }

            // Create user element
            const userElement = document.createElement('div');
            userElement.className = 'like-user-item';
            userElement.innerHTML = `
                <img src="${avatarUrl}" class="like-user-avatar" alt="${username}">
                <span class="like-username">${username}</span>
            `;

            container.prepend(userElement);

            // Make username clickable
            const usernameSpan = userElement.querySelector('.like-username');
            this.makeUsernameClickable(usernameSpan, username);

        } catch (error) {
            //.error('Error rendering like user:', error);
        }
    }
    // Add missing carousel and other functionality
    initializeCarousel(postElement, postId) {
        const carousel = postElement.querySelector('.post-carousel');
        const prevBtn = carousel.querySelector('.carousel-prev');
        const nextBtn = carousel.querySelector('.carousel-next');
        const dots = carousel.querySelectorAll('.dot');
        prevBtn?.addEventListener('click', () => this.previousSlide(postId, postElement));
        nextBtn?.addEventListener('click', () => this.nextSlide(postId, postElement));
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => this.goToSlide(postId, index, postElement));
        });
    }

    previousSlide(postId, postElement = null) {
        const element = postElement || document.querySelector(`[data-post-id="${postId}"]`);
        const carousel = element?.querySelector('.post-carousel');
        const slides = carousel?.querySelectorAll('.carousel-slide');
        const dots = carousel?.querySelectorAll('.dot');
        if (!slides || slides.length <= 1) return;
        const currentIndex = Array.from(slides).findIndex(slide => slide.classList.contains('active'));
        const prevIndex = currentIndex === 0 ? slides.length - 1 : currentIndex - 1;
        slides[currentIndex].classList.remove('active');
        slides[prevIndex].classList.add('active');
        dots[currentIndex].classList.remove('active');
        dots[prevIndex].classList.add('active');
    }

    nextSlide(postId, postElement = null) {
        const element = postElement || document.querySelector(`[data-post-id="${postId}"]`);
        const carousel = element?.querySelector('.post-carousel');
        const slides = carousel?.querySelectorAll('.carousel-slide');
        const dots = carousel?.querySelectorAll('.dot');
        if (!slides || slides.length <= 1) return;
        const currentIndex = Array.from(slides).findIndex(slide => slide.classList.contains('active'));
        const nextIndex = currentIndex === slides.length - 1 ? 0 : currentIndex + 1;
        slides[currentIndex].classList.remove('active');
        slides[nextIndex].classList.add('active');
        dots[currentIndex].classList.remove('active');
        dots[nextIndex].classList.add('active');
    }

    goToSlide(postId, targetIndex, postElement = null) {
        const element = postElement || document.querySelector(`[data-post-id="${postId}"]`);
        const carousel = element?.querySelector('.post-carousel');
        const slides = carousel?.querySelectorAll('.carousel-slide');
        const dots = carousel?.querySelectorAll('.dot');
        if (!slides || slides.length <= 1 || targetIndex < 0 || targetIndex >= slides.length) return;
        const currentIndex = Array.from(slides).findIndex(slide => slide.classList.contains('active'));
        if (currentIndex !== targetIndex) {
            slides[currentIndex].classList.remove('active');
            slides[targetIndex].classList.add('active');
            dots[currentIndex].classList.remove('active');
            dots[targetIndex].classList.add('active');
        }
    }

    // Post Modal functionality
    async showPostModal(post) {
        try {
            //.log('Showing post modal for:', post);

            const [likesList, commentsList, authorAvatar] = await Promise.all([
                this.fetchBlogLikes(post.stringID),
                this.fetchBlogComments(post.stringID),
                this.getUserAvatar(post.author)
            ]);
            const isSaved = this.checkBlogSaved(post.stringID);
            const isLiked = await this.checkIfUserLiked(post);

            const modal = document.getElementById('post-modal');
            if (!modal) {
                //.error('Post modal not found in DOM');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 10));

            const modalImageContainer = modal.querySelector('.post-modal-image-container') || (modal.querySelector('.post-modal-image') ? modal.querySelector('.post-modal-image').parentElement : null);
            const modalAvatar = modal.querySelector('.post-modal-avatar');
            const modalUsername = modal.querySelector('.post-modal-username');
            const modalCaptionAvatar = modal.querySelector('.post-modal-caption-avatar');
            const modalCaptionUsername = modal.querySelector('.post-modal-caption-username');
            const modalCaptionText = modal.querySelector('.post-modal-caption-text');
            const modalCaptionTime = modal.querySelector('.post-modal-caption-time');
            const modalLikes = modal.querySelector('.post-modal-likes');
            const modalTime = modal.querySelector('.post-modal-time');

            let followBtn = modal.querySelector('.post-modal-follow-btn');
            if (!followBtn) {
                followBtn = modal.querySelector('button[class*="follow"]');
                if (!followBtn) {
                    const headerDiv = modal.querySelector('.post-modal-header');
                    if (headerDiv) {
                        followBtn = document.createElement('button');
                        followBtn.className = 'post-modal-follow-btn';
                        followBtn.textContent = 'Follow';
                        headerDiv.prepend(followBtn);
                        //.log('Created missing follow button');
                    }
                }
            }

            const likeBtn = modal.querySelector('.post-modal-like-btn');
            const saveBtn = modal.querySelector('.post-modal-save-btn');
            const menuBtn = modal.querySelector('.post-menu-btn'); // Get the menu button

            if (!followBtn) {
                //.warn('Follow button not found in modal');
            }
            if (!likeBtn) {
                //.warn('Like button not found in modal');
            }
            if (!saveBtn) {
                //.warn('Save button not found in modal');
            }
            if (!menuBtn) {
                //.warn('Menu button not found in modal');
            }

            if (modalImageContainer) {
                const imageUrls = post.imageUrls || [];
                if (imageUrls.length > 0) {
                    const carouselHtml = `
                          <div class="post-carousel">
                              ${imageUrls.map((url, i) => `
                                  <div class="carousel-slide ${i === 0 ? 'active' : ''}">
                                      <img src="${url}" alt="Post image ${i + 1}" class="post-modal-image">
                                  </div>
                              `).join('')}
                              ${imageUrls.length > 1 ? `
                                  <button class="carousel-prev">
                                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                          <polyline points="15,18 9,12 15,6"></polyline>
                                      </svg>
                                  </button>
                                  <button class="carousel-next">
                                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                          <polyline points="9,18 15,12 9,6"></polyline>
                                      </svg>
                                  </button>
                                  <div class="carousel-dots">
                                      ${imageUrls.map((_, i) => `
                                          <span class="dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>
                                      `).join('')}
                                  </div>
                              ` : ''}
                          </div>
                      `;
                    modalImageContainer.innerHTML = carouselHtml;
                    if (imageUrls.length > 1) {
                        this.initializeCarousel(modal, post.stringID);
                    }
                } else {
                    modalImageContainer.innerHTML = `<img src="${this.defaultPostImage}" alt="Post image" class="post-modal-image">`;
                }
            }
            if (modalAvatar) modalAvatar.src = authorAvatar || this.profileUserAvatar;
            if (modalAvatar) {
                modalAvatar.src = authorAvatar || this.profileUserAvatar;
                this.makeUsernameClickable(modalAvatar, post.author);
            }
            if (modalUsername) {
                modalUsername.textContent = post.author;
                this.makeUsernameClickable(modalUsername, post.author);
            }
            if (modalCaptionAvatar) {
                modalCaptionAvatar.src = authorAvatar || this.profileUserAvatar;
                this.makeUsernameClickable(modalCaptionAvatar, post.author);
            }
            if (modalCaptionUsername) {
                modalCaptionUsername.textContent = post.author;
                this.makeUsernameClickable(modalCaptionUsername, post.author);
            }
            if (modalCaptionText) modalCaptionText.textContent = post.caption || '';
            if (modalCaptionTime) modalCaptionTime.textContent = await this.getTimeAgo(post.standardTime);
            if (modalLikes) modalLikes.textContent = `${likesList.length} likes`;
            if (modalTime) modalTime.textContent = await this.getTimeAgo(post.standardTime);

            if (likeBtn) {
                likeBtn.setAttribute('data-liked', isLiked);
                const likeSvg = likeBtn.querySelector('svg');
                if (likeSvg) {
                    likeSvg.setAttribute('fill', isLiked ? '#ff3040' : 'none');
                    likeSvg.setAttribute('stroke', isLiked ? '#ff3040' : '#262626');
                }
            }

            if (saveBtn) {
                saveBtn.setAttribute('data-saved', isSaved);
                const saveSvg = saveBtn.querySelector('svg');
                if (saveSvg) {
                    saveSvg.setAttribute('fill', isSaved ? '#0095f6' : 'none');
                    saveSvg.setAttribute('stroke', isSaved ? '#0095f6' : '#262626');
                }
            }

            if (followBtn) {
                if (post.author === this.currentUser) {
                    followBtn.style.display = 'none';
                } else {
                    followBtn.style.display = 'block';
                    const isFollowing = this.checkUserFollowing(post.author);
                    followBtn.textContent = isFollowing ? 'Following' : 'Follow';
                    followBtn.className = isFollowing ? 'post-modal-following-btn' : 'post-modal-follow-btn';
                }
            } else {
                //.warn('Follow button not found in modal');
            }

            // Set data-post-owner attribute for the menu button in the modal
            if (menuBtn) {
                menuBtn.setAttribute('data-post-owner', post.author === this.currentUser);
            }

            const commentsSection = modal.querySelector('.post-modal-comments-section');
            if (commentsSection) {
                commentsSection.style.display = '';
                const commentList = commentsSection.querySelector('.post-modal-comments-list');
                if (commentList) {
                    commentList.innerHTML = '';
                    if (commentsList && Array.isArray(commentsList) && commentsList.length > 0) {
                        for (const comment of commentsList) {
                            if (comment && comment.comment && comment.comment.trim()) {
                                const depth = comment.depth || 0;
                                const commentElement = await this.createCommentTree(comment, depth, post.stringID);
                                if (commentElement) {
                                    commentList.prepend(commentElement);
                                }
                            }
                        }
                    } else {
                        const noComments = document.createElement('div');
                        noComments.className = 'no-comments';
                        noComments.textContent = 'No comments yet';
                        commentList.prepend(noComments);
                    }
                } else {
                    //.warn('Comment list not found in post modal');
                }

            }

            this.setupPostModalEventListeners(modal, post.stringID, post);
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';

        } catch (error) {
            //.error('Error showing post modal:', error);
            this.showError('Failed to open post. Please try again.');
        }
    }

    async refreshPostModalComments(postId) {
        const modal = document.getElementById('post-modal');
        if (!modal || !modal.classList.contains('active')) {
            return;
        }

        const commentList = modal.querySelector('.post-modal-comments-list');
        if (!commentList) {
            //.error('Post modal comment list not found for refresh.');
            return;
        }

        try {
            commentList.innerHTML = '<div class="loading">Refreshing comments...</div>';
            const commentsList = await this.fetchBlogComments(postId);
            commentList.innerHTML = '';

            if (commentsList && Array.isArray(commentsList) && commentsList.length > 0) {
                for (const comment of commentsList) {
                    if (comment && comment.comment && comment.comment.trim()) {
                        const depth = comment.depth || 0;
                        const commentElement = await this.createCommentTree(comment, depth, postId);
                        if (commentElement) {
                            commentList.prepend(commentElement);
                        }
                    }
                }
            } else {
                const noComments = document.createElement('div');
                noComments.className = 'no-comments';
                noComments.textContent = 'No comments yet';
                commentList.prepend(noComments);
            }
        } catch (error) {
            //.error('Error refreshing post modal comments:', error);
            commentList.innerHTML = '<div class="error">Failed to load comments.</div>';
        }
    }


    setupPostModalEventListeners(modal, postId, post) {
        const likesModal = modal.querySelector('.post-modal-likes');
        const likeBtn = modal.querySelector('.post-modal-like-btn');
        const commentBtn = modal.querySelector('.post-modal-comment-btn');
        const saveBtn = modal.querySelector('.post-modal-save-btn');
        const followBtn = modal.querySelector('.post-modal-follow-btn')|| modal.querySelector('.post-modal-following-btn');
        const closeBtn = modal.querySelector('.close-post-modal');
        const commentInput = modal.querySelector('.post-modal-comment-input');
        const commentPostBtn = modal.querySelector('.post-modal-comment-post');
        const menuBtn = modal.querySelector('.post-menu-btn'); // Get the menu button
        //.log(likeBtn, commentBtn, saveBtn, followBtn, closeBtn, commentInput, commentPostBtn);

        if (likesModal) {
            const newLikesModal = likesModal.cloneNode(true);
            likesModal.parentNode.replaceChild(newLikesModal, likesModal);
            newLikesModal.addEventListener('click', async () => {
                this.showLikesModal(postId);
            });
        }

        if (likeBtn) {
            const newLikeBtn = likeBtn.cloneNode(true);
            likeBtn.parentNode.replaceChild(newLikeBtn, likeBtn);

            newLikeBtn.addEventListener('click', async () => {
                await this.togglePostModalLike(post, newLikeBtn, modal);
            });
        }

        if (saveBtn) {
            const newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

            newSaveBtn.addEventListener('click', async () => {
                await this.togglePostModalSave(postId, newSaveBtn);
            });
        }

        if (commentBtn) {
            const newCommentBtn = commentBtn.cloneNode(true);
            commentBtn.parentNode.replaceChild(newCommentBtn, commentBtn);

            newCommentBtn.addEventListener('click', () => {
                this.closePostModal(modal);
                this.showCommentsModal(postId);
            });
        }

        if (followBtn) {
            const newFollowBtn = followBtn.cloneNode(true);
            followBtn.parentNode.replaceChild(newFollowBtn, followBtn);

            newFollowBtn.addEventListener('click', async () => {
                await this.togglePostModalFollow(post.author, newFollowBtn);
            });
        }

        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

            newCloseBtn.addEventListener('click', () => {
                this.closePostModal(modal);
            });
        }

        if (commentInput && commentPostBtn) {
            const newCommentInput = commentInput.cloneNode(true);
            const newCommentPostBtn = commentPostBtn.cloneNode(true);
            commentInput.parentNode.replaceChild(newCommentInput, commentInput);
            commentPostBtn.parentNode.replaceChild(newCommentPostBtn, commentPostBtn);

            newCommentInput.addEventListener('input', () => {
                newCommentPostBtn.disabled = newCommentInput.value.trim().length === 0;
            });

            newCommentInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter' && !e.shiftKey && !newCommentPostBtn.disabled) {
                    e.preventDefault();
                    await this.submitPostModalComment(postId, newCommentInput, modal);
                }
            });

            newCommentPostBtn.addEventListener('click', async () => {
                await this.submitPostModalComment(postId, newCommentInput, modal);
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closePostModal(modal);
            }
        });

        const commentsList = modal.querySelector('.post-modal-comments-list');
        if (commentsList) {
            // Remove existing listener if it exists to prevent duplicates
            if (this.handleCommentLikeClickInPostModal) {
                commentsList.removeEventListener('click', this.handleCommentLikeClickInPostModal);
            }

            // Define the new listener function
            this.handleCommentLikeClickInPostModal = async (e) => {
                const likeBtn = e.target.closest('.comment-like-btn');
                if (likeBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const commentId = likeBtn.dataset.commentId;
                    if (!commentId) return;

                    const likeCountEl = likeBtn.closest('.comment-like-section')?.querySelector('.comment-like-count');
                    const isCurrentlyLiked = likeBtn.getAttribute('data-liked') === 'true';
                    const svg = likeBtn.querySelector('svg');
                    const currentLikes = parseInt(likeCountEl?.textContent, 10) || 0;

                    // --- Optimistic UI Update ---
                    const newLikedState = !isCurrentlyLiked;
                    const newLikeCount = newLikedState ? currentLikes + 1 : Math.max(0, currentLikes - 1);

                    likeBtn.setAttribute('data-liked', String(newLikedState));
                    if (svg) {
                        svg.setAttribute('fill', newLikedState ? '#ff3040' : 'none');
                    }
                    if (likeCountEl) {
                        likeCountEl.textContent = newLikeCount;
                        likeCountEl.style.display = newLikeCount > 0 ? 'inline' : 'none';
                    }
                    // --- End Optimistic UI Update ---

                    likeBtn.disabled = true;
                    try {
                        let response;
                        if (newLikedState) {
                            response = await fetch(`${this.baseUrl}/user/like-comment/cmnt-id=${commentId}`, {
                                method: 'POST',
                                credentials: 'include'
                            });
                        } else {
                            response = await fetch(`${this.baseUrl}/user/delete-cmntlike/cmnt-id=${commentId}`, {
                                method: 'DELETE',
                                credentials: 'include'
                            });
                        }

                        if (!response.ok) {
                            throw new Error(`Failed to update like status: ${response.statusText}`);
                        }



                    } catch (error) {
                        //.error('Error toggling comment like in post modal:', error);
                        // Revert UI on error
                        likeBtn.setAttribute('data-liked', String(isCurrentlyLiked));
                        if (svg) {
                            svg.setAttribute('fill', isCurrentlyLiked ? '#ff3040' : 'none');
                        }
                        if (likeCountEl) {
                            likeCountEl.textContent = currentLikes;
                            likeCountEl.style.display = currentLikes > 0 ? 'inline' : 'none';
                        }
                    } finally {
                        likeBtn.disabled = false;
                    }
                }
            };
            commentsList.addEventListener('click', this.handleCommentLikeClickInPostModal);
        }

        // Event listener for the post-menu-btn
        if (menuBtn) {
            const newMenuBtn = menuBtn.cloneNode(true);
            menuBtn.parentNode.replaceChild(newMenuBtn, menuBtn);
            newMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openReportOptionsModal(post.author, postId, e); // Pass author and post ID
            });
        }
    }

    closePostModal(modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }

    // Helper methods
    async getUserAvatar(username) {
        try {
            if (username === this.loggedInUser.username) {
                return this.loggedInUserAvatar;
            }
            if (username === this.profileUser.username) {
                return this.profileUserAvatar;
            }

            const userResponse = await fetch(`${this.baseUrl}/user/get-user/username=${encodeURIComponent(username)}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (userResponse.ok) {
                const userData = await userResponse.json();
                if (userData.profileAvatarID) {
                    const avatarResponse = await fetch(`${this.baseUrl}/files/get-files/file-id=${userData.profileAvatarID}`, {
                        credentials: 'include'
                    });
                    if (avatarResponse.ok) {
                        const blob = await avatarResponse.blob();
                        return URL.createObjectURL(blob);
                    }
                }
            }
            return '1.png';
        } catch (e) {
            //.warn('Failed to load avatar for user:', username, e);
            return '1.png';
        }
    }


    checkBlogSaved(blogId) {
        if (blogId && this.loggedInUser && this.loggedInUser.savedPost) {
            return this.loggedInUser.savedPost.includes(blogId);
        }
        return false;
    }

    checkUserFollowing(username) {
        if (username && this.loggedInUser && this.loggedInUser.following) {
            return this.loggedInUser.following.includes(username);
        }
        return false;
    }

    async checkIfFollowRequestSent(username) {
        if (username && this.loggedInUser && this.loggedInUser.sentRequests) {
            return this.loggedInUser.sentRequests.includes(username);
        }
        return false;
    }

    // This function is used to get the current user's like ID for a given blog post.
    async getCurrentUserLikeId(blogId) {
        // Fetch the user's like ID from the server.
        const res = await fetch(`${this.baseUrl}/user/get-likeID/blog-id=${blogId}`, { credentials: 'include' });
        // If the response is not ok, return null.
        if (!res.ok) {
            // This is expected if the user hasn't liked the post, or if there's a server error.
            // We don't need to log a big error, just return null.
            return null;
        }

        // Get the text from the response.
        const text = await res.text();
        // If the text is empty, return null.
        if (!text) {
            // This is a valid case if the user hasn't liked the post.
            return null;
        }

        try {
            // Parse the text as JSON.
            const data = JSON.parse(text);
            // Use stringID if present and has a value
            if (typeof data.stringID === 'string' && data.stringID) return data.stringID;
            // Use likeId if present and has a value
            if (typeof data.likeId === 'string' && data.likeId) return data.likeId;
            // Use likeId.$oid if present and has a value
            if (data.likeId && typeof data.likeId === 'object' && data.likeId.$oid) return data.likeId.$oid;
            // Use id if present and has a value
            if (typeof data.id === 'string' && data.id) return data.id;
            // Use id.$oid if present and has a value
            if (data.id && typeof data.id === 'object' && data.id.$oid) return data.id.$oid;
            
            // If none of the above conditions are met, return null.
            return null;
        } catch (e) {
            // Log an error if the JSON parsing fails.
            //.error("Failed to parse JSON from text:", text, e);
            // Return null.
            return null;
        }
    }



    // Helper function to check if the current user has liked an item (post or comment)
  checkIfUserLiked(item) {
        if (!item || !item.likedBy || !Array.isArray(item.likedBy)) {
            return false;
        }
        return item.likedBy.includes(this.currentUser);
    }


    // Modal action methods
    async togglePostModalLike(post, likeBtnElement, modal) {
        const postId = post.stringID;
        const currentlyLiked = likeBtnElement.getAttribute('data-liked') === 'true';
        const newLikedState = !currentlyLiked;
        const likesElement = modal.querySelector('.post-modal-likes');

        try {
            // Optimistic UI update for modal
            likeBtnElement.setAttribute('data-liked', String(newLikedState));
            const svg = likeBtnElement.querySelector('svg');
            svg.setAttribute('fill', newLikedState ? '#ff3040' : 'none');
            svg.setAttribute('stroke', newLikedState ? '#ff3040' : '#262626');

            if (likesElement) {
                const currentLikes = parseInt(likesElement.textContent) || 0;
                const newLikeCount = newLikedState ? currentLikes + 1 : Math.max(0, currentLikes - 1);
                likesElement.textContent = `${newLikeCount} likes`;
            }

            // Make API call
            let response;
            if (newLikedState) {
                response = await fetch(`${this.baseUrl}/user/add-likes/${postId}`, { method: 'POST', credentials: 'include' });
            } else {
                const likeId = await this.getCurrentUserLikeId(postId);
                if (likeId) {
                    response = await fetch(`${this.baseUrl}/user/delete-like/like-id=${likeId}`, { method: 'DELETE', credentials: 'include' });
                } else {
                    response = new Response(null, { status: 200 }); // Already unliked
                }
            }

            if (!response.ok) {
                throw new Error('Failed to toggle like status');
            }

            // On success, update the local data model
            const targetPost = this.allPosts.find(p => p.stringID === postId);
            if (targetPost) {
                 if (!targetPost.likedBy) {
                    targetPost.likedBy = [];
                }
                if (newLikedState) {
                    if (!targetPost.likedBy.includes(this.currentUser)) {
                        targetPost.likedBy.push(this.currentUser);
                    }
                } else {
                    const index = targetPost.likedBy.indexOf(this.currentUser);
                    if (index > -1) {
                        targetPost.likedBy.splice(index, 1);
                    }
                }
            }

        } catch (error) {
            //.error('Error toggling post modal like:', error);
            // Revert UI on error
            likeBtnElement.setAttribute('data-liked', String(currentlyLiked));
            const svg = likeBtnElement.querySelector('svg');
            svg.setAttribute('fill', currentlyLiked ? '#ff3040' : 'none');
            svg.setAttribute('stroke', currentlyLiked ? '#ff3040' : '#262626');
            if (likesElement) {
                const currentLikes = parseInt(likesElement.textContent) || 0;
                const revertedCount = currentlyLiked ? currentLikes - 1 : Math.max(0, currentLikes + 1);
                likesElement.textContent = `${revertedCount} likes`;
            }
        }
    }

    async togglePostModalSave(postId, saveBtn) {
        const isSaved = saveBtn.getAttribute('data-saved') === 'true';
        const newSavedState = !isSaved;

        if (saveBtn.disabled) return;
        saveBtn.disabled = true;

        // Optimistic UI update
        saveBtn.setAttribute('data-saved', String(newSavedState));
        const svg = saveBtn.querySelector('svg');
        if (svg) {
            svg.setAttribute('fill', newSavedState ? '#0095f6' : 'none');
            svg.setAttribute('stroke', newSavedState ? '#0095f6' : '#262626');
        }

        try {
            const response = await fetch(`${this.baseUrl}/user/${newSavedState ? 'save' : 'unsave'}-post/blog-id=${postId}`, {
                method: newSavedState ? 'POST' : 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to update save status');
            }

            // Update local user object for consistency
            if (this.loggedInUser && this.loggedInUser.savedPost) {
                if (newSavedState) {
                    this.loggedInUser.savedPost.push(postId);
                } else {
                    this.loggedInUser.savedPost = this.loggedInUser.savedPost.filter(id => id !== postId);
                }
            }

        } catch (error) {
            //.error('Error toggling save:', error);
            // Revert UI on error
            saveBtn.setAttribute('data-saved', String(isSaved));
            if (svg) {
                svg.setAttribute('fill', isSaved ? '#0095f6' : 'none');
                svg.setAttribute('stroke', isSaved ? '#0095f6' : '#262626');
            }
        } finally {
            saveBtn.disabled = false;
        }
    }

    async togglePostModalFollow(username, followBtn) {
        let isFollowing = this.checkUserFollowing(username);
        const action = isFollowing ? 'unfollow' : 'follow';
        const method = isFollowing ? 'DELETE' : 'POST';
        const successMessage = isFollowing ? 'Unfollowed successfully!' : 'Followed successfully!';
        const errorMessage = isFollowing ? 'Failed to unfollow.' : 'Failed to follow.';

        try {
            followBtn.disabled = true;
            followBtn.textContent = isFollowing ? 'Unfollowing...' : 'Following...';

            const userResponse = await fetch(`${this.baseUrl}/user/get-user/username=${encodeURIComponent(username)}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!userResponse.ok) throw new Error('Failed to get user data');

            const userData = await userResponse.json();
            const userId = userData.stringID;

            const response = await fetch(`${this.baseUrl}/user/${action}-user/user-id=${userId}`, {
                method: method,
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Optimistic update of local state
            if (this.loggedInUser && this.loggedInUser.following) {
                if (isFollowing) {
                    this.loggedInUser.following = this.loggedInUser.following.filter(f => f !== username);
                } else {
                    this.loggedInUser.following.push(username);
                }
            }

            this.showMessage(successMessage, 'success');
            
            // Update button based on new state
            const newIsFollowing = this.checkUserFollowing(username);
            followBtn.textContent = newIsFollowing ? 'Following' : 'Follow';
            followBtn.className = newIsFollowing ? 'post-modal-following-btn' : 'post-modal-follow-btn';

            // If the user in the modal is the same as on the profile page, update the main display
            if (this.profileUser && this.profileUser.username === username) {
                if (isFollowing) {
                    this.profileUser.numberOfFollower = (this.profileUser.numberOfFollower || 1) - 1;
                } else {
                    this.profileUser.numberOfFollower = (this.profileUser.numberOfFollower || 0) + 1;
                }
                this.updateProfileDisplay();
            }

        } catch (error) {
            //.error(`Error toggling follow status in modal:`, error);
            this.showError(errorMessage + ' Please try again.');
            // Revert button on error
            followBtn.textContent = isFollowing ? 'Following' : 'Follow';
            followBtn.className = isFollowing ? 'post-modal-following-btn' : 'post-modal-follow-btn';
        } finally {
            followBtn.disabled = false;
        }
    }

    async submitPostModalComment(postId, commentInput, modal) {
        const commentText = commentInput.value.trim();
        if (!commentText || commentText === '') {
            commentInput.value = '';
            return;
        }

        const commentPostBtn = modal.querySelector('.post-modal-comment-post');
        const originalValue = commentInput.value;
        commentInput.disabled = true;
        if (commentPostBtn) {
            commentPostBtn.disabled = true;
            commentPostBtn.textContent = 'Posting...';
        }

        try {
            const response = await fetch(`${this.baseUrl}/user/add-comment/${postId}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: commentText ,
                                        standardTime: new Date().toISOString(),
                })
            });

            if (response.ok) {
                const newComment = await response.json();
                const commentsContainer = modal.querySelector('.post-modal-comments-list');

                if (commentsContainer) {
                    const noComments = commentsContainer.querySelector('.no-comments');
                    if (noComments) {
                        noComments.remove();
                    }
                    const commentElement = await this.createCommentTree(newComment, 0, postId);
                    if (commentElement) {
                        commentsContainer.prepend(commentElement);
                    }
                }
                // await this.refreshPostModalComments(postId); // Refresh comments after adding
            } else {
                this.showError('Failed to post comment. Please try again.');
                throw new Error('Failed to post comment');
            }
        } catch (error) {
            //.error('Error adding comment:', error);
            commentInput.value = commentText;
        } finally {
            commentInput.disabled = false;
            if (commentPostBtn) {
                commentPostBtn.disabled = (commentInput.value.trim().length === 0);
                commentPostBtn.textContent = 'Post';
            }
        }
    }

    // Comments modal functionality
    async showCommentsModal(postId) {
        //.log('Showing comments for post:', postId);
        this.currentPostId = postId;
        const modal = document.getElementById('comments-modal');
        if (!modal) {
            //.error('Comments modal not found');
            return;
        }

        // FIXED: Clear previous content and show modal properly
        modal.style.display = 'block';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scroll

        // Clear comment input and update avatar
        const commentInput = modal.querySelector('.comment-input');
        const commentInputAvatar = modal.querySelector('.comment-input-avatar');
        if (commentInput) {
            commentInput.value = '';
        }
        if (commentInputAvatar) {
            commentInputAvatar.src = this.loggedInUserAvatar;
        }

        await this.renderCommentsModal(postId);
    }

    async renderComment(comment, container, depth = 0, postId) {
        const el = await this.createCommentTree(comment, depth, postId);
        if (el && container) {
            container.prepend(el);
        }
    }
    async renderCommentsModal(postId) {
        const modal = document.getElementById('comments-modal');
        const commentsContainer = modal?.querySelector('.comments-container');
        if (!commentsContainer) return;

        try {
            // Show loading state
            commentsContainer.innerHTML = '<div class="loading">Loading comments...</div>';

            // Fetch comments for the post
            const comments = await this.fetchBlogComments(postId);
            //.log(comments);

            // Clear loading state
            commentsContainer.innerHTML = '';

            if (!comments || !Array.isArray(comments) || comments.length === 0) {
                commentsContainer.innerHTML = `
                      <div class="no-comments">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8e8e8e" stroke-width="1.5">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"/>
                          </svg>
                          <p>No comments yet</p>
                          <p class="no-comments-sub">Be the first to comment!</p>
                      </div>`;
                return;
            }

            // Get the comment template and clear it from the DOM
            const template = commentsContainer.querySelector('.comment-template');
            if (template) {
                template.remove();
            }

            const filteredComments = comments.filter(comment => comment !== null);
            // Sort comments by date (newest first)
            const sortedComments = [...filteredComments].sort((a, b) =>
                new Date(b.createdAt) - new Date(a.createdAt)
            );

            // Render each comment
            for (const comment of sortedComments) {
                await this.renderComment(comment, commentsContainer, 0, postId);
            }

            // Focus the comment input
            const commentInput = modal.querySelector('.comment-input');
            if (commentInput) {
                commentInput.focus();
            }

        } catch (error) {
            //.error('Error loading comments:', error);
            commentsContainer.innerHTML = `
                  <div class="error">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ff3040" stroke-width="1.5">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="8" x2="12" y2="12"/>
                          <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <p>Failed to load comments</p>
                      <button class="retry-btn">Try Again</button>
                  </div>`;

            // Add retry button handler
            const retryBtn = commentsContainer.querySelector('.retry-btn');
            if (retryBtn) {
                retryBtn.onclick = () => this.renderCommentsModal(postId);
            }
        }
    }

    async createCommentTree(comment, depth = 0, postId) {
        if (!comment || !comment.stringID) return null;

        // Check if the current user has liked this comment
        const isLiked = await this.checkIfUserLiked(comment);
        const likeCount = comment.likes || 0;
        const canDelete =
            (comment.author === this.currentUser) ||
            (this.allPosts?.find(p => p.stringID === postId)?.author === this.currentUser);

        const avatarUrl = await this.getUserAvatar(comment.author);

        // Format time
        let timeAgo = await this.getTimeAgo(comment.standardTime);

        // Create comment container with proper tree indentation
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment-tree-item';
        commentDiv.setAttribute('data-comment-id', comment.stringID);
        commentDiv.setAttribute('data-depth', depth);
        const indentPx = depth * 25;
        commentDiv.style.marginLeft = `${indentPx}px`;
        if (depth > 0) {
            commentDiv.style.borderLeft = '2px solid #e1e1e1';
            commentDiv.style.paddingLeft = '15px';
            commentDiv.style.marginTop = '8px';
        }
        // SVG heart icon for like button
        const heartIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? '#ff3040' : 'none'}" stroke="#ff3040" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
        // Like icon and count at top right
        const likeSection = `
              <div class="comment-like-section">
                  <button class="comment-like-btn" data-liked="${isLiked}" data-comment-id="${comment.stringID}">${heartIcon}</button>
                  <span class="comment-like-count" style="display:${likeCount > 0 ? 'inline' : 'none'}">${likeCount}</span>
              </div>
          `;
        commentDiv.innerHTML = `
              <div class="comment-content-wrapper" style="position: relative;">
                  <div class="comment-header">
                      <img src="${avatarUrl}" class="comment-avatar" alt="${comment.author}">
                      <div class="comment-body">
                          <div class="comment-main-row">
                              <span class="comment-username">${comment.author}</span>
                              <span class="comment-time">${timeAgo}</span>
                          </div>
                          <div class="comment-text-row">
                              <span class="comment-text" style="align-text=left">${comment.comment}</span>
                          </div>
                          <div class="comment-actions-row">
                              <button class="comment-reply-btn" data-comment-id="${comment.stringID}">Reply</button>
                              ${canDelete ? `<button class="comment-delete-btn" data-comment-id="${comment.stringID}">Delete</button>` : ''}
                          </div>
                          ${comment.replies && Array.isArray(comment.replies) && comment.replies.length > 0 ? `<button class="view-replies-btn" style="margin-top:6px;text-decoration:none;">-- view replies</button>` : ''}
                      </div>
                      ${likeSection}
                  </div>
              </div>
              <div class="reply-input-container" style="display: none;"></div>
              <div class="replies-container"></div>
          `;
        // Make username clickable
        const commentUsernameElement = commentDiv.querySelector('.comment-username');
        this.makeUsernameClickable(commentUsernameElement, comment.author);

        this.setupCommentEventListeners(commentDiv, comment, postId);
        // Recursively render replies with increased depth
        const repliesContainer = commentDiv.querySelector('.replies-container');
        if (comment.replies && Array.isArray(comment.replies) && comment.replies.length > 0) {
            for (const reply of comment.replies) {
                const replyElement = await this.createCommentTree(reply, depth + 1, postId);
                if (replyElement) {
                    repliesContainer.prepend(replyElement);
                }
            }
        }
        return commentDiv;
    }

    async submitReply(parentCommentId, text, postId) {
        try {
            const response = await fetch(`${this.baseUrl}/user/reply-comment/cmnt-id=${parentCommentId}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: text })
            });

            if (!response.ok) {
                this.showError('Failed to add reply. Please try again.');
                throw new Error('Failed to add reply');}

            const newReply = await response.json();

            // Find the parent comment element
            const parentCommentDiv = document.querySelector(`.comment-tree-item[data-comment-id="${parentCommentId}"]`);
            if (parentCommentDiv) {
                const repliesContainer = parentCommentDiv.querySelector('.replies-container');
                const viewRepliesBtn = parentCommentDiv.querySelector('.view-replies-btn');

                // If replies are visible, add the new one directly
                // Ensure the reply input is hidden and cleared after successful submission
                const replyInputContainer = parentCommentDiv.querySelector('.reply-input-container');
                if (replyInputContainer) {
                    replyInputContainer.style.display = 'none';
                    replyInputContainer.innerHTML = ''; // Clear the reply input unconditionally
                }

                // If replies are visible, add the new one directly
                if (repliesContainer && (this.expandedReplies.has(parentCommentId) || !viewRepliesBtn)) {
                    const depth = (parseInt(parentCommentDiv.getAttribute('data-depth')) || 0) + 1;
                    const replyElement = await this.createCommentTree(newReply, depth, postId);
                    if (replyElement) {
                        repliesContainer.prepend(replyElement);
                    }
                } else if (viewRepliesBtn) {
                    // If replies are hidden, we should probably just indicate that there's a new reply.
                    // For a better UX, we can fetch the new count or just change the text.
                    viewRepliesBtn.textContent = '-- view replies'; // Indicate new content is available
                }
            }

        } catch (error) {
            //.error('Error adding reply:', error);
            this.showError('Failed to add reply. Please try again.');
        }
    }

    // Function to toggle the reply input
    async toggleReplyInput(commentDiv, commentId, postId) {
        // Get the reply container
        const replyContainer = commentDiv.querySelector('.reply-input-container');

        // If the reply container is not displayed
        if (replyContainer.style.display === 'none') {
            // Show reply input
            replyContainer.style.display = 'block';
            replyContainer.innerHTML = `
                  <div class="reply-input-wrapper">
                      <input type="text" class="reply-input" placeholder="Write a reply..." />
                      <button class="submit-reply">Reply</button>
                      <button class="cancel-reply">Cancel</button>
                  </div>
              `;

            // Get the input, submit and cancel buttons
            const input = replyContainer.querySelector('.reply-input');
            const submitBtn = replyContainer.querySelector('.submit-reply');
            const cancelBtn = replyContainer.querySelector('.cancel-reply');

            // Focus input
            input.focus();

            // Submit on Enter
            input.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const text = input.value.trim();
                    if (text) {
                        await this.submitReply(commentId, text, postId);
                        replyContainer.style.display = 'none';
                    }
                }
            });

            // Submit button
            submitBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const text = input.value.trim();
                if (text) {
                    await this.submitReply(commentId, text, postId);
                    replyContainer.style.display = 'none';
                }
            });

            // Cancel button
            cancelBtn.addEventListener('click', () => {
                replyContainer.style.display = 'none';
            });
        } else {
            // Hide reply input
            replyContainer.style.display = 'none';
        }
    }



    async fetchCommentById(commentId) {
        try {
            const res = await fetch(`${this.baseUrl}/user/get-comments/comment-id=${commentId}`, { credentials: 'include' });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            return null;
        }
    }

    setupCommentsModal() {
        //.log('Setting up comments modal...');
        const modal = document.getElementById('comments-modal');
        const closeBtn = modal?.querySelector('.close-comments-modal');
        const commentInput = modal?.querySelector('.comment-input');
        const submitComment = modal?.querySelector('.submit-comment');
        const commentsContainer = modal?.querySelector('.comments-container');

        if (!modal || !commentInput || !submitComment || !commentsContainer) {
            //.warn('Comments modal elements not found', { modal, commentInput, submitComment, commentsContainer });
            return;
        }

        const handleCommentInput = () => {
            submitComment.disabled = commentInput.value.trim() === '';
            commentInput.style.height = 'auto';
            commentInput.style.height = Math.min(commentInput.scrollHeight, 80) + 'px';
        };

        commentInput.addEventListener('input', handleCommentInput);
        handleCommentInput();

        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                modal.style.display = 'none';
                modal.classList.remove('active');
                document.body.style.overflow = '';
                this.currentPostId = null;
                //.log('Modal closed by close button');
            };
        }

        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                modal.classList.remove('active');
                document.body.style.overflow = '';
                this.currentPostId = null;
                //.log('Modal closed by backdrop click');
            }
        };

        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.onclick = (e) => {
                e.stopPropagation();
            };
        }

        commentsContainer.addEventListener('click', async (e) => {
            const likeBtn = e.target.closest('.comment-like-btn');
            if (likeBtn) {
                e.preventDefault();
                e.stopPropagation();
                const commentId = likeBtn.dataset.commentId;
                if (!commentId) return;

                const likeCountEl = likeBtn.closest('.comment-like-section')?.querySelector('.comment-like-count');
                const isCurrentlyLiked = likeBtn.getAttribute('data-liked') === 'true';
                const svg = likeBtn.querySelector('svg');
                const currentLikes = parseInt(likeCountEl?.textContent, 10) || 0;

                // --- Optimistic UI Update ---
                const newLikedState = !isCurrentlyLiked;
                const newLikeCount = newLikedState ? currentLikes + 1 : Math.max(0, currentLikes - 1);

                likeBtn.setAttribute('data-liked', String(newLikedState));
                if (svg) {
                    svg.setAttribute('fill', newLikedState ? '#ff3040' : 'none');
                }
                if (likeCountEl) {
                    likeCountEl.textContent = newLikeCount;
                    likeCountEl.style.display = newLikeCount > 0 ? 'inline' : 'none';
                }
                // --- End Optimistic UI Update ---

                likeBtn.disabled = true;
                try {
                    let response;
                    if (newLikedState) {
                        response = await fetch(`${this.baseUrl}/user/like-comment/cmnt-id=${commentId}`, {
                            method: 'POST',
                            credentials: 'include'
                        });
                    } else {
                        response = await fetch(`${this.baseUrl}/user/delete-cmntlike/cmnt-id=${commentId}`, {
                            method: 'DELETE',
                            credentials: 'include'
                        });
                    }

                    if (!response.ok) {
                        throw new Error(`Failed to update like status: ${response.statusText}`);
                    }

                   

                } catch (error) {
                    //.error('Error toggling comment like:', error);
                    // Revert UI on error
                    likeBtn.setAttribute('data-liked', String(isCurrentlyLiked));
                    if (svg) {
                        svg.setAttribute('fill', isCurrentlyLiked ? '#ff3040' : 'none');
                    }
                    if (likeCountEl) {
                        likeCountEl.textContent = currentLikes;
                        likeCountEl.style.display = currentLikes > 0 ? 'inline' : 'none';
                    }
                } finally {
                    likeBtn.disabled = false;
                }
            }
        });

        commentInput.onkeydown = async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const text = commentInput.value.trim();
                if (text && this.currentPostId) {
                    commentInput.disabled = true;
                    submitComment.disabled = true;
                    submitComment.textContent = 'Posting...';
                    try {
                        await this.addComment(this.currentPostId, text);
                    } catch (error) {
                        //.error('Error posting comment:', error);
                    } finally {
                        commentInput.disabled = false;
                        submitComment.disabled = false;
                        submitComment.textContent = 'Post';
                        handleCommentInput();
                    }
                    commentInput.value = ''; // Clear input after successful post
                    commentInput.style.height = '36px'; // Reset height
                }
            }
        };

        submitComment.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const text = commentInput.value.trim();
            //.log('Post button clicked, text:', text, 'currentPostId:', this.currentPostId);
            if (text && this.currentPostId) {
                commentInput.disabled = true;
                submitComment.disabled = true;
                submitComment.textContent = 'Posting...';
                try {
                    await this.addComment(this.currentPostId, text);
                } finally {
                    commentInput.disabled = false;
                    submitComment.disabled = false;
                    submitComment.textContent = 'Post';
                }
                commentInput.value = ''; // Clear input after successful post
                commentInput.style.height = '36px'; // Reset height
            }
        };

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && (modal.style.display === 'block' || modal.classList.contains('active'))) {
                modal.style.display = 'none';
                modal.classList.remove('active');
                document.body.style.overflow = '';
                this.currentPostId = null;
                //.log('Modal closed by Escape key');
            }
        });
    }

  
    async addComment(postId, text) {
        try {
            //.log('addComment called with:', { postId, text });
            // Send API request
            const response = await fetch(`${this.baseUrl}/user/add-comment/${postId}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: text ,standardTime: new Date().toISOString() })
            });
            //.log('addComment response:', response);
            if (!response.ok) {
                this.showError('Failed to add comment. Please try again.');
                throw new Error('Failed to add comment');}

            // Remove "No comments yet" message if it exists
            const commentsContainer = document.querySelector('.comments-container');
            const noCommentsDiv = commentsContainer?.querySelector('.no-comments');
            if (noCommentsDiv) {
                noCommentsDiv.remove();
            }

            // Optimistically add the new comment to the DOM
            const newComment = await response.json();
            if (commentsContainer && newComment && newComment.stringID) {
                const commentElement = await this.createCommentTree(newComment, 0, postId);
                if (commentElement) {
                    commentsContainer.prepend(commentElement);
                }
            }
        } catch (error) {
            //.error('Error adding comment:', error);
        }
    }

    async setupCommentEventListeners(commentDiv, comment, postId) {
        const commentId = comment.stringID;
        const replyBtn = commentDiv.querySelector('.comment-reply-btn');
        const deleteBtn = commentDiv.querySelector('.comment-delete-btn');

        // Reply functionality
        if (replyBtn) {
            replyBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleReplyInput(commentDiv, commentId, postId);
            };
        }

        // Delete functionality
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                try {
                    commentDiv.remove();
                    await fetch(`${this.baseUrl}/user/delete-comment/cmnt-id=${commentId}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    // Refresh comments in the modal after deletion
                    // await this.refreshPostModalComments(postId);
                } catch (err) {
                    //.error('Error deleting comment:', err);
                    this.showError('Failed to delete comment. Please refresh and try again.');
                }
            });
        }

        // Add event listener for view replies button
        const viewRepliesBtn = commentDiv.querySelector('.view-replies-btn');
        const repliesContainer = commentDiv.querySelector('.replies-container');
        if (viewRepliesBtn && comment.replies && comment.replies.length > 0) {
            // Initialize repliesExpanded state for this specific comment
            let isRepliesExpanded = this.expandedReplies.has(comment.stringID);

            // Set initial text based on state
            viewRepliesBtn.textContent = isRepliesExpanded ? '-- hide replies' : `-- view ${comment.replies.length} replies`;

            if (isRepliesExpanded) {
                // If already expanded, render replies immediately
                for (const reply of comment.replies) {
                    const replyElement = await this.createCommentTree(reply, 0, postId);
                    if (replyElement) {
                        repliesContainer.prepend(replyElement);
                    }
                }
            }

            viewRepliesBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!this.expandedReplies.has(comment.stringID)) {
                    // Fetch all reply objects from the backend
                    try {
                        const res = await fetch(`${this.baseUrl}/user/get-all-replies/comment-id=${comment.stringID}`, { credentials: 'include' });
                        if (res.ok) {
                            const replies = await res.json();
                            // Clear existing replies before rendering new ones to prevent duplicates
                            repliesContainer.innerHTML = '';
                            const sortedReplies = [...replies].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                            for (const reply of sortedReplies) {
                                const replyElement = await this.createCommentTree(reply, 1, postId);
                                if (replyElement) {
                                    repliesContainer.prepend(replyElement);
                                }
                            }
                        }
                    } catch (err) {
                        //.error('Failed to fetch replies for comment', comment.stringID, err);
                    }
                    viewRepliesBtn.textContent = '-- hide replies';
                    this.expandedReplies.add(comment.stringID);
                } else {
                    repliesContainer.innerHTML = ''; // Clear replies when collapsing
                    viewRepliesBtn.textContent = `-- view ${comment.replies.length} replies`;
                    this.expandedReplies.delete(comment.stringID);
                }
            };
        }
    }

    makeUsernameClickable(usernameElement, username) {
        if (usernameElement && username) {
            usernameElement.style.cursor = 'pointer';
            usernameElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `profile.html?username=${encodeURIComponent(username)}`;
            });
        }
    }

    async fetchAllStories(targetUsername) {
        try {
            let url = `${this.baseUrl}/user/get-my-story`; // Default to logged-in user's stories
            if (targetUsername) {
                url = `${this.baseUrl}/user/get-story/username=${encodeURIComponent(targetUsername)}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            let fetchedStories = await response.json();
            //.log('Fetched stories for', targetUsername || 'current user', ':', fetchedStories);

            const storiesByUser = new Map();
            if (this.loggedInUser && this.loggedInUser.username) {
                // Ensure fetchedStories is an array, even if it's a single object
                if (!Array.isArray(fetchedStories)) {
                    fetchedStories = [fetchedStories];
                }

                fetchedStories.forEach(story => {
                    if (!story || !story.postedBy) return;

                    if (!storiesByUser.has(story.postedBy)) {
                        storiesByUser.set(story.postedBy, {
                            author: story.postedBy,
                            stories: [],
                            profileAvatarID: story.profileAvatarID,
                            viewed: true // Assume all are viewed initially
                        });
                    }

                    const userStoryGroup = storiesByUser.get(story.postedBy);
                    userStoryGroup.stories.push(story);

                    // If even one story is not viewed, the group is not viewed
                    if (!story.viewedBy || !story.viewedBy.includes(this.loggedInUser.username)) {
                        userStoryGroup.viewed = false;
                    }
                });
            }

            this.stories = Array.from(storiesByUser.values());

        } catch (error) {
            //.error('Error fetching stories:', error);
            this.stories = []; // Clear stories on error
        }
    }

    async renderStoryModalContent() {
        const storyCarousel = document.getElementById('storyCarousel');
        const prevStoryButton = document.getElementById('prevStory');
        const nextStoryButton = document.getElementById('nextStory');
        const storyProfilePic = document.getElementById('storyProfilePic');
        const storyUsernameSpan = document.getElementById('storyUsername');

        storyCarousel.innerHTML = '';
        if (this.allStories.length === 0) {
            storyCarousel.innerHTML = '<p style="color: white;">No stories available.</p>';
            if (prevStoryButton) prevStoryButton.style.display = 'none';
            if (nextStoryButton) nextStoryButton.style.display = 'none';
            return;
        }

        if (prevStoryButton) prevStoryButton.style.display = 'block';
        if (nextStoryButton) nextStoryButton.style.display = 'block';

        if (this.currentStoryIndex < 0) this.currentStoryIndex = this.allStories.length - 1;
        if (this.currentStoryIndex >= this.allStories.length) this.currentStoryIndex = 0;

        const activeStoryGroup = this.allStories[this.currentStoryIndex];
        const activeStory = activeStoryGroup.stories[activeStoryGroup.currentStory || 0];

        // Mark story as viewed
        if (activeStory && this.loggedInUser) {
            // Ensure viewedBy is an array and contains unique values before adding
            activeStory.viewedBy = activeStory.viewedBy ? [...new Set(activeStory.viewedBy)] : [];

            if (!activeStory.viewedBy.includes(this.loggedInUser.username)) {
                try {
                    const storyId = activeStory.stringID || activeStory.id;
                    await fetch(`${this.baseUrl}/user/view-story/story-id=${storyId}`, {
                        method: 'GET',
                        credentials: 'include'
                    });
                    activeStory.viewedBy.push(this.loggedInUser.username);
                } catch (error) {
                    //.error('Error marking story as viewed:', error);
                }
            }
        }

        // Update header
        if (activeStoryGroup && activeStory) {
            const avatarUrl = await this.getUserAvatar(activeStoryGroup.author);
            if (storyProfilePic) storyProfilePic.src = avatarUrl || 'default-avatar.png';
        if (storyUsernameSpan) {
            const timeAgo = await this.getTimeAgo(activeStory.standardTime);
            storyUsernameSpan.innerHTML = `${activeStoryGroup.author} <span class="story-time">${timeAgo}</span>`;
                // Make the username part clickable
                const usernamePart = storyUsernameSpan.firstChild;
                if (usernamePart) {
                    const clickableUsername = document.createElement('span');
                    clickableUsername.textContent = activeStoryGroup.author;
                    clickableUsername.style.cursor = 'pointer';
                    clickableUsername.onclick = () => this.openProfile(activeStoryGroup.author);
                    storyUsernameSpan.innerHTML = '';
                    storyUsernameSpan.appendChild(clickableUsername);
                    storyUsernameSpan.append(` `); // Add a space
                    const timeSpan = document.createElement('span');
                    timeSpan.className = 'story-time';
                    timeSpan.textContent = timeAgo;
                    storyUsernameSpan.appendChild(timeSpan);
                }
            }
        }

        // Render all stories in the current group
        activeStoryGroup.stories.forEach((story, index) => {
            const storyItem = document.createElement('div');
            storyItem.classList.add('carousel-item');
            if (index === (activeStoryGroup.currentStory || 0)) {
                storyItem.classList.add('active');
            }

            const fileUrl = `${this.baseUrl}/files/get-files/file-id=${story.fileID}`;
            const fileExtension = story.fileType ? story.fileType.split('/')[1] : 'jpg';

            if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension)) {
                storyItem.innerHTML = `<img src="${fileUrl}" alt="Story content">`;
            } else if (['mp4', 'webm', 'ogg'].includes(fileExtension)) {
                storyItem.innerHTML = `<video src="${fileUrl}" controls autoplay loop muted></video>`;
            } else {
                storyItem.innerHTML = `<p style="color: white;">Unsupported file type: ${story.fileType}</p>`;
            }
            storyCarousel.appendChild(storyItem);
        });

        this.updateStoryLikeButton(activeStory);
        this.updateStoryDeleteButton(activeStory);
        this.updateViewStoryButton(activeStory);
        this.updateStoryCarouselUI(); // Initial UI update after rendering content
    }

    async updateStoryCarouselUI() {
        const storyCarousel = document.getElementById('storyCarousel');
        const storyProfilePic = document.getElementById('storyProfilePic');
        const storyUsernameSpan = document.getElementById('storyUsername');

        if (!storyCarousel) return;

        const activeStoryGroup = this.allStories[this.currentStoryIndex];
        if (!activeStoryGroup) return;

        const currentStorySubIndex = activeStoryGroup.currentStory || 0;

        // Update header
        const activeStory = activeStoryGroup.stories[currentStorySubIndex];
        this.getUserAvatar(activeStoryGroup.author).then(avatarUrl => {
            if (storyProfilePic) storyProfilePic.src = avatarUrl || 'default-avatar.png';
        });
        if (storyUsernameSpan && activeStory) {
            const timeAgo =  await this.getTimeAgo(activeStory.standardTime);
            storyUsernameSpan.innerHTML = `${activeStoryGroup.author} <span class="story-time">${timeAgo}</span>`;
             // Make the username part clickable
             const usernamePart = storyUsernameSpan.firstChild;
             if (usernamePart) {
                 const clickableUsername = document.createElement('span');
                 clickableUsername.textContent = activeStoryGroup.author;
                 clickableUsername.style.cursor = 'pointer';
                 clickableUsername.onclick = () => this.openProfile(activeStoryGroup.author);
                 storyUsernameSpan.innerHTML = '';
                 storyUsernameSpan.appendChild(clickableUsername);
                 storyUsernameSpan.append(` `); // Add a space
                 const timeSpan = document.createElement('span');
                 timeSpan.className = 'story-time';
                 timeSpan.textContent = timeAgo;
                 storyUsernameSpan.appendChild(timeSpan);
             }
        }

        // Update active carousel item
        const carouselItems = storyCarousel.querySelectorAll('.carousel-item');
        carouselItems.forEach((item, index) => {
            if (index === currentStorySubIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    updateStoryLikeButtonUI(isLiked, likesCount) {
        const likeStoryButton = document.querySelector('.like-story-btn');
        const storyLikesCount = document.querySelector('.story-likes-count');
        if (likeStoryButton) {
            likeStoryButton.setAttribute('data-liked', String(isLiked));
            const svg = likeStoryButton.querySelector('svg');
            if (svg) {
                svg.setAttribute('fill', isLiked ? '#ff3040' : 'none');
                svg.setAttribute('stroke', isLiked ? '#ff3040' : '#fff');
            }
        }
        if (storyLikesCount) {
            storyLikesCount.textContent = `${likesCount} likes`;
        }
    }

    updateStoryLikeButton(story) {
        const storyLikedByDiv = document.querySelector('.story-liked-by');
        const likeStoryButton = document.querySelector('.like-story-btn');
        const storyLikesCount = document.querySelector('.story-likes-count');

        if (!story) {
            this.updateStoryLikeButtonUI(false, 0);
            if (storyLikedByDiv) storyLikedByDiv.style.display = 'none';
            return;
        }
        const isLiked = story.likedBy && story.likedBy.includes(this.loggedInUser.username);
        const likesCount = story.likedBy ? story.likedBy.length : 0;
        this.updateStoryLikeButtonUI(isLiked, likesCount);

        if (story.postedBy === this.loggedInUser.username) {
            if (likeStoryButton) likeStoryButton.style.display = 'none';
            if (storyLikesCount) storyLikesCount.style.display = 'none';
            if (storyLikedByDiv) storyLikedByDiv.style.display = 'none';
        } else {
            if (likeStoryButton) likeStoryButton.style.display = 'block';
            if (likeStoryButton) likeStoryButton.disabled = false;
            if (storyLikesCount) storyLikesCount.style.display = 'none';
            if (storyLikesCount) storyLikesCount.style.cursor = 'default';
            if (storyLikesCount) storyLikesCount.onclick = null;
            if (storyLikedByDiv) storyLikedByDiv.style.display = 'none';
        }
    }

    updateStoryDeleteButton(story) {
        const deleteStoryButton = document.querySelector('.delete-story-btn');
        if (deleteStoryButton) {
            if (story && story.postedBy === this.loggedInUser.username) {
                deleteStoryButton.style.display = 'block';
            } else {
                deleteStoryButton.style.display = 'none';
            }
        }
    }

    async openStoryViewersModal(story) {
        const viewersModal = document.getElementById('storyViewersModal');
        const viewersList = document.getElementById('storyViewersList');
        const viewersCountSpan = document.getElementById('viewersCount');

        if (!viewersModal || !viewersList || !viewersCountSpan) {
            //.error('Viewers modal elements not found.');
            return;
        }

        viewersList.innerHTML = '<p>Loading...</p>';
        viewersCountSpan.textContent = '0';
        viewersModal.classList.add('active');
        viewersModal.style.display = 'flex'; // Ensure the modal is visible

        try {
            if (story && story.viewedBy) {
                //.log('Raw story.viewedBy:', story.viewedBy); // Diagnostic log
                const uniqueViewers = [...new Set(story.viewedBy)]; // Ensure unique viewers
                //.log('Unique viewers after Set conversion:', uniqueViewers); // Diagnostic log

                viewersCountSpan.textContent = uniqueViewers.length;
                viewersList.innerHTML = '';

                if (uniqueViewers.length === 0) {
                    viewersList.innerHTML = '<p>No views yet.</p>';
                    return;
                }
                //.log('Rendering unique viewers:', uniqueViewers); // Added diagnostic log

                for (const username of uniqueViewers) {
                    //.log(`Fetching avatar for viewer: ${username}`);
                    const avatarUrl = await this.getUserAvatar(username);
                    const hasLiked = story.likedBy && story.likedBy.includes(username);
                    const viewerItem = document.createElement('div');
                    viewerItem.classList.add('story-viewer-item');
                    const heartIconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#ff3040" stroke="#ff3040" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
                    viewerItem.innerHTML = `
                        <img src="${avatarUrl || 'default-avatar.png'}" alt="${username}'s avatar" class="story-viewer-avatar">
                        <span class="story-viewer-username">${username}</span>
                        ${hasLiked ? `<span class="story-like-icon">${heartIconSvg}</span>` : ''}
                    `;
                    viewersList.appendChild(viewerItem);
                    const usernameSpan = viewerItem.querySelector('.story-viewer-username');
                    this.makeUsernameClickable(usernameSpan, username);
                }
                //.log('Number of viewer items in DOM after rendering:', viewersList.children.length); // Added diagnostic log
            } else {
                viewersList.innerHTML = '<p>Could not load viewers.</p>';
            }
        } catch (error) {
            //.error('Error fetching story viewers:', error);
            viewersList.innerHTML = '<p>Error loading viewers.</p>';
        }
    }

   async  updateViewStoryButton(story) {
        const viewStoryButton = document.querySelector('.view-story-btn');
        const storyViewsCount = document.querySelector('.story-views-count');
        const storyViewedByDiv = document.querySelector('.story-viewed-by');

        if (viewStoryButton && storyViewsCount && storyViewedByDiv) {
            if (story && this.loggedInUser && story.postedBy === this.loggedInUser.username) {
                viewStoryButton.style.display = 'inline-block'; // Use inline-block to keep it in flow
                storyViewsCount.style.display = 'none';
                storyViewedByDiv.style.display = 'flex'; // Ensure this div is shown and uses flex for alignment
                storyViewedByDiv.style.alignItems = 'center'; // Align items vertically
                storyViewedByDiv.style.justifyContent = 'center'; // Center horizontally

                const viewsCount = story.viewedBy ? story.viewedBy.length : 0;
                storyViewsCount.textContent = `${viewsCount} views`;

                // Remove existing listener to prevent duplicates
                storyViewedByDiv.removeEventListener('click', this._storyViewedByClickHandler);

                // Define and attach new click handler
                this._storyViewedByClickHandler = (e) => {
                    e.stopPropagation();
                    this.openStoryViewersModal(story);
                };
                storyViewedByDiv.addEventListener('click', this._storyViewedByClickHandler);

            } else {
                viewStoryButton.style.display = 'none';
                storyViewsCount.style.display = 'none';
                storyViewedByDiv.style.display = 'none';
                // Remove listener when not displayed
                if (this._storyViewedByClickHandler) {
                    storyViewedByDiv.removeEventListener('click', this._storyViewedByClickHandler);
                }
            }
        }
    }

    setupStoryModalEventListeners() {
        const storyModal = document.getElementById('storyModal');
        const storyViewersModal = document.getElementById('storyViewersModal');

        if (!storyModal) {
            //.warn('Story modal not found, skipping event listeners setup.');
            return;
        }

        const closeButton = storyModal.querySelector('.close-button');
        const prevStoryButton = document.getElementById('prevStory');
        const nextStoryButton = document.getElementById('nextStory');
        const likeStoryButton = document.querySelector('.like-story-btn');
        const deleteStoryButton = document.querySelector('.delete-story-btn');
        const closeViewersModalButton = storyViewersModal ? storyViewersModal.querySelector('.close-button') : null;

        if (closeButton) {
            closeButton.onclick = () => {
                storyModal.style.display = 'none';
            };
        }

        // Close modal when clicking on the backdrop
        storyModal.addEventListener('click', (event) => {
            if (event.target === storyModal) {
                storyModal.style.display = 'none';
            }
        });

        // Prevent clicks inside modal-content from closing the modal
        const modalContent = storyModal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', (event) => {
                event.stopPropagation();
            });
        }

        if (storyViewersModal) {
            storyViewersModal.onclick = (event) => {
                if (event.target === storyViewersModal) {
                    storyViewersModal.style.display = 'none';
                    storyViewersModal.classList.remove('active');
                }
            };
        }

        if (closeViewersModalButton) {
            closeViewersModalButton.onclick = () => {
                storyViewersModal.style.display = 'none';
                storyViewersModal.classList.remove('active');
            };
        }

        if (prevStoryButton) {
            prevStoryButton.onclick = async () => {
                const activeStoryGroup = this.allStories[this.currentStoryIndex];
                if (!activeStoryGroup) return;

                let newStoryGroupIndex = this.currentStoryIndex;
                let newStorySubIndex = activeStoryGroup.currentStory || 0;

                newStorySubIndex--;

                if (newStorySubIndex < 0) {
                    // At the beginning of the user's stories, so just stop.
                    return;
                }

                this.currentStoryIndex = newStoryGroupIndex;
                this.allStories[this.currentStoryIndex].currentStory = newStorySubIndex;

                const newActiveStory = this.allStories[this.currentStoryIndex].stories[newStorySubIndex];
                if (newActiveStory && this.loggedInUser) {
                    // Ensure newActiveStory.viewedBy is an array before checking includes
                    newActiveStory.viewedBy = newActiveStory.viewedBy ? [...new Set(newActiveStory.viewedBy)] : [];
                    if (!newActiveStory.viewedBy.includes(this.loggedInUser.username)) {
                        try {
                            const storyId = newActiveStory.stringID || newActiveStory.id;
                            await fetch(`${this.baseUrl}/user/view-story/story-id=${storyId}`, {
                                method: 'GET',
                                credentials: 'include'
                            });
                            newActiveStory.viewedBy.push(this.loggedInUser.username);
                        } catch (error) {
                            //.error('Error marking story as viewed:', error);
                        }
                    }
                }

                this.updateStoryCarouselUI();
                this.updateStoryLikeButton(newActiveStory);
                this.updateStoryDeleteButton(newActiveStory);
                this.updateViewStoryButton(newActiveStory);
            };
        }

        if (nextStoryButton) {
            nextStoryButton.onclick = async () => {
                const activeStoryGroup = this.allStories[this.currentStoryIndex];
                if (!activeStoryGroup) return;

                let newStoryGroupIndex = this.currentStoryIndex;
                let newStorySubIndex = activeStoryGroup.currentStory || 0;

                newStorySubIndex++;

                if (newStorySubIndex >= activeStoryGroup.stories.length) {
                    // At the end of the user's stories, close the modal.
                    storyModal.style.display = 'none';
                    return;
                }

                this.currentStoryIndex = newStoryGroupIndex;
                this.allStories[this.currentStoryIndex].currentStory = newStorySubIndex;

                const newActiveStory = this.allStories[this.currentStoryIndex].stories[newStorySubIndex];
                if (newActiveStory && this.loggedInUser) {
                    // Ensure newActiveStory.viewedBy is an array before checking includes
                    newActiveStory.viewedBy = newActiveStory.viewedBy ? [...new Set(newActiveStory.viewedBy)] : [];
                    if (!newActiveStory.viewedBy.includes(this.loggedInUser.username)) {
                        try {
                            const storyId = newActiveStory.stringID || newActiveStory.id;
                            await fetch(`${this.baseUrl}/user/view-story/story-id=${storyId}`, {
                                method: 'GET',
                                credentials: 'include'
                            });
                            newActiveStory.viewedBy.push(this.loggedInUser.username);
                        }catch(err){
                            console.error('Error marking story as viewed:', err);
                        }
                    }
                }

                this.updateStoryCarouselUI();
                this.updateStoryLikeButton(newActiveStory);
                this.updateStoryDeleteButton(newActiveStory);
                this.updateViewStoryButton(newActiveStory);
            };
        }

        if (likeStoryButton) {
            likeStoryButton.onclick = async () => {
                const activeStoryGroup = this.allStories[this.currentStoryIndex];
                if (!activeStoryGroup) return;

                const storyIndex = activeStoryGroup.currentStory || 0;
                const activeStory = activeStoryGroup.stories[storyIndex];
                if (!activeStory) return;

                const storyId = activeStory.stringID || activeStory.id;

                const isLiked = activeStory.likedBy && activeStory.likedBy.includes(this.loggedInUser.username);
                const newLikedState = !isLiked;

                const currentLikesCount = activeStory.likedBy ? activeStory.likedBy.length : 0;
                this.updateStoryLikeButtonUI(newLikedState, currentLikesCount + (newLikedState ? 1 : -1));

                try {
                    let response;
                    if (newLikedState) {
                        response = await fetch(`${this.baseUrl}/user/like-story/story-id=${storyId}`, {
                            method: 'POST',
                            credentials: 'include'
                        });
                    } else {
                        response = await fetch(`${this.baseUrl}/user/remove-story-like/story-id=${storyId}`, {
                            method: 'DELETE',
                            credentials: 'include'
                        });
                    }

                    if (!response.ok) {
                        throw new Error(`Failed to toggle story like: ${response.status}`);
                    }

                    if (newLikedState) {
                        if (!activeStory.likedBy) activeStory.likedBy = [];
                        if (!activeStory.likedBy.includes(this.loggedInUser.username)) {
                            activeStory.likedBy.push(this.loggedInUser.username);
                        }
                    } else {
                        if (activeStory.likedBy) {
                            const index = activeStory.likedBy.indexOf(this.loggedInUser.username);
                            if (index > -1) {
                                activeStory.likedBy.splice(index, 1);
                            }
                        }
                    }
                } catch (error) {
                    //.error('Error toggling story like:', error);
                    this.updateStoryLikeButtonUI(isLiked, currentLikesCount);
                    // alert('Failed to like/unlike story.');
                    this.showError('Failed to like/unlike story. Please try again later.');
                }
            };
        }

        if (deleteStoryButton) {
            deleteStoryButton.onclick = async () => {
                const activeStoryGroup = this.allStories[this.currentStoryIndex];
                if (!activeStoryGroup) return;

                const storyIndexToDelete = activeStoryGroup.currentStory || 0;
                const storyToDelete = activeStoryGroup.stories[storyIndexToDelete];
                if (!storyToDelete) return;

                const storyId = storyToDelete.stringID || storyToDelete.id;

                if (confirm('Are you sure you want to delete this story?')) {
                    try {
                        const response = await fetch(`${this.baseUrl}/user/remove-story/story-id=${storyId}`, {
                            method: 'DELETE',
                            credentials: 'include'
                        });

                        if (!response.ok) {
                            this.showError(`Failed to delete story: ${response.statusText}`);
                            throw new Error(`Failed to delete story: ${response.status}`);
                        }

                        this.showMessage('Story deleted successfully!', 'success');

                        // Remove the deleted story from the active story group
                        activeStoryGroup.stories.splice(storyIndexToDelete, 1);

                        if (activeStoryGroup.stories.length === 0) {
                            // If the group is now empty, remove the entire group
                            this.allStories.splice(this.currentStoryIndex, 1);
                            // Adjust currentStoryIndex if it's out of bounds
                            if (this.currentStoryIndex >= this.allStories.length && this.allStories.length > 0) {
                                this.currentStoryIndex = this.allStories.length - 1;
                            } else if (this.allStories.length === 0) {
                                this.currentStoryIndex = 0; // No stories left
                            }
                            // Close the modal if no stories are left
                            storyModal.style.display = 'none';
                        } else {
                            // If there are still stories in the group, adjust currentStory
                            if (activeStoryGroup.currentStory >= activeStoryGroup.stories.length) {
                                activeStoryGroup.currentStory = activeStoryGroup.stories.length - 1;
                            }
                            // Re-render the story modal content to reflect the updated story list
                            this.renderStoryModalContent();
                        }

                        // There are no story circles on the profile page to re-render.

                    } catch (error) {
                        //.error('Error deleting story:', error);
                        // alert('Failed to delete story.');
                        this.showError('Failed to delete story.');
                    }
                }
            };
        }
    }
    openCreatePostModalForStory() {
        this.isPostingStory = true;
        const modal = document.getElementById('postStoryModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    setupStoryModal() {
        const postStoryModal = document.getElementById('postStoryModal');
        const storyUploadArea = document.getElementById('story-upload-area');
        const storyFileInput = document.getElementById('storyFileInput');
        const selectFilesBtn = postStoryModal?.querySelector('.select-files-btn');
        const closeButton = postStoryModal?.querySelector('.close-button');

        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.closeStoryModal();
            });
        }

        if (postStoryModal) {
            postStoryModal.addEventListener('click', (event) => {
                if (event.target === postStoryModal) {
                    this.closeStoryModal();
                }
            });

            const modalContent = postStoryModal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.addEventListener('click', (event) => {
                    event.stopPropagation();
                });
            }
        }

        if (storyUploadArea) {
            storyUploadArea.addEventListener('click', () => {
                storyFileInput.click();
            });

            storyUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                storyUploadArea.classList.add('drag-over');
            });

            storyUploadArea.addEventListener('dragleave', () => {
                storyUploadArea.classList.remove('drag-over');
            });

            storyUploadArea.addEventListener('drop', async (e) => {
                e.preventDefault();
                storyUploadArea.classList.remove('drag-over');
                const files = Array.from(e.dataTransfer.files);
                await this.handleImageSelection(files);
            });
        }

        if (selectFilesBtn) {
            selectFilesBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                storyFileInput.click();
            });
        }

        if (storyFileInput) {
            storyFileInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files);
                if (files.length > 0) {
                    await this.handleImageSelection(files);
                }
            });
        }
    }

    closeStoryModal() {
        const modal = document.getElementById('postStoryModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
        this.isPostingStory = false;
    }

    async uploadStory(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const uploadResponse = await fetch(`${this.baseUrl}/files/upload-files`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                throw new Error(`Failed to upload story file: ${errorText}`);
            }

            const fileData = await uploadResponse.json();
            const fileId = fileData.stringID;
            const story = {
                fileID: fileId,
                standardTime: new Date().toISOString()
            };

           const postStoryResponse = await fetch(`${this.baseUrl}/user/post-story`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(story),
                credentials: 'include'
            });

            if (!postStoryResponse.ok) {
                const errorData = await postStoryResponse.text();
                throw new Error(`Failed to create story: ${postStoryResponse.status} - ${errorData}`);
            }

            this.showMessage('Story uploaded successfully!', 'success');
            
            // Reset form
            const storyFileInput = document.getElementById('storyFileInput');
            if (storyFileInput) {
                storyFileInput.value = '';
            }

        } catch (error) {
            //.error('Error uploading story:', error);
            this.showMessage('Failed to upload story. Please try again.', 'error');
            throw error; // Re-throw so postStoryWithCroppedFile can handle it
        }
    }

 

    async postStoryWithCroppedFile(file) {
        try {
            this.closeModal('cropper-modal');
            this.closeModal('postStoryModal'); // Corrected modal name

            await this.uploadStory(file);

            // Refresh stories view after successful upload
            if (this.fetchAllStories) {
                await this.fetchAllStories();
            }

        } catch (error) {
            // uploadStory() now re-throws the error, so we catch it here.
            // The error message is already shown to the user in uploadStory.
            //.error('Error during postStoryWithCroppedFile flow:', error);
        } finally {
            this.isCroppingForStory = false; // Reset the flag
            this.croppedFiles = []; // Clear cropped files
            this.filesToCrop = []; // Clear files to crop
        }
    }

    async handleImageSelection(files) {
        this.filesToCrop = Array.from(files);
        this.croppedFiles = [];
        this.isCroppingForStory = this.isPostingStory; // Set based on the current mode

        if (this.filesToCrop.length > 0) {
            this.showCropperForNextFile();
        }
    }


    showCropperForNextFile() {
        if (this.filesToCrop.length === 0) {
            // All files have been processed
            const cropperModal = document.getElementById('crop-modal');
            cropperModal.classList.remove('active');
            if (this.cropper) {
                this.cropper.destroy();
                this.cropper = null;
            }

            // If cropping for a story, post it now
            if (this.isCroppingForStory && this.croppedFiles.length > 0) {
                this.postStoryWithCroppedFile(this.croppedFiles[0]);
                this.isCroppingForStory = false; // Reset flag
            }
            return;
        }

        const file = this.filesToCrop.shift(); // Get the next file to crop
        const reader = new FileReader();

        reader.onload = (e) => {
            const cropperModal = document.getElementById('crop-modal');
            const cropperImage = document.getElementById('image-to-crop');
            cropperImage.src = e.target.result;
            cropperModal.classList.add('active');

            if (this.cropper) {
                this.cropper.destroy();
            }

            this.cropper = new Cropper(cropperImage, {
                aspectRatio: 1,
                viewMode: 1,
            });
        };
        reader.readAsDataURL(file);
    }

    setupCropperModal() {
        const modal = document.getElementById('crop-modal');
        const cropBtn = document.getElementById('crop-btn');
        const cancelCropBtn = document.getElementById('cancel-crop-btn');

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeCropperModal();
                }
            });

            // Prevent clicks inside modal-content from closing the modal
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.addEventListener('click', (event) => {
                    event.stopPropagation();
                });
            }
        }

        if (cancelCropBtn) {
            cancelCropBtn.addEventListener('click', () => {
                this.closeCropperModal();
            });
        }

        if (cropBtn) {
            cropBtn.addEventListener('click', () => this.cropAndUpload());
        }
    }

    closeCropperModal() {
        const modal = document.getElementById('crop-modal');
        if (modal) {
            modal.classList.remove('active');
        }
        
        // If user closes cropper modal without cropping all files, clear filesToCrop
        this.filesToCrop = [];
        this.croppedFiles = [];
        this.isCroppingForStory = false; // Reset flag
        
        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    async getUserAvatar(username) {
        try {
            const userData = await this.fetchUserData(username);
            if (userData && userData.profileAvatarID) {
                const avatarResponse = await fetch(`${this.baseUrl}/files/get-files/file-id=${userData.profileAvatarID}`, {
                    credentials: 'include'
                });
                if (avatarResponse.ok) {
                    const blob = await avatarResponse.blob();
                    return URL.createObjectURL(blob);
                }
            }
        } catch (error) {
            //.warn(`Failed to load avatar for ${username}:`, error);
        }
        return this.loggedInUserAvatar || '1.png';
    }

    async fetchUserData(username) {
        try {
            const response = await fetch(`${this.baseUrl}/user/get-user/username=${encodeURIComponent(username)}`, {
                credentials: 'include'
            });
            if (response.status === 404) return null;
            const userData = await response.json();
            if (response.status === 423) {
                userData.isLocked = true;
            }
            return userData;
        } catch (error) {
            //.error(`Error fetching data for user ${username}:`, error);
            return null;
        }
    }

    makeUsernameClickable(element, username) {
        if (element) {
            element.style.cursor = 'pointer';
            element.addEventListener('click', () => {
                this.openProfile(username);
            });
        }
    }

    openProfile(username) {
        window.location.href = `profile.html?username=${encodeURIComponent(username)}`;
    }

    async getTimeAgo(date) {
    // If date is null, undefined, or an empty string, return a default value
    if (!date) {
        return 'Unknown time';
    }

    const now = Date.now(); // milliseconds since epoch, always UTC
    const parsedDate = new Date(date); // also milliseconds UTC if ISO string with Z
    console.log('Calculating time ago for:', date, 'Parsed date:', parsedDate, 'Now:', now); // Keep this for valid dates

    if (isNaN(parsedDate)) {
        return 'Invalid Date';
    }

    let diffSeconds = Math.floor((now - parsedDate) / 1000);

    const units = [
        { limit: 60, divisor: 1, suffix: 's' },      // < 1 min
        { limit: 3600, divisor: 60, suffix: 'm' },   // < 1 hr
        { limit: 86400, divisor: 3600, suffix: 'h' },// < 1 day
        { limit: 604800, divisor: 86400, suffix: 'd' }, // < 1 week
        { limit: 2592000, divisor: 604800, suffix: 'w' }, // < 1 month
        { limit: 31536000, divisor: 2592000, suffix: 'mo' }, // < 1 year
        { limit: Infinity, divisor: 31536000, suffix: 'y' }
    ];

    for (const { limit, divisor, suffix } of units) {
        if (diffSeconds < limit) {
            return `${Math.floor(diffSeconds / divisor)}${suffix}`;
        }
    }
}

    setupMoreButton() {
        this.setupTextExpansion('.bio-text', 50);
        this.setupTextExpansion('#bioLinks', 40, true);
    }

    setupTextExpansion(selector, limit, isList = false) {
        document.querySelectorAll(selector).forEach(element => {
            // Ensure we have the original, full content before any modifications
            if (!element.dataset.fullHtml) {
                element.dataset.fullHtml = element.innerHTML;
            }
            const fullHtml = element.dataset.fullHtml;
            let shortHtml;
            let isOverflowing;

            if (isList) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = fullHtml;
                const items = Array.from(tempDiv.children);
                let currentLength = 0;
                let itemsToShow = 0;

                for (const item of items) {
                    const itemLength = item.textContent.length;
                    if (currentLength + itemLength > limit && itemsToShow > 0) {
                        break;
                    }
                    currentLength += itemLength;
                    itemsToShow++;
                }

                isOverflowing = items.length > itemsToShow;
                if (isOverflowing) {
                    shortHtml = items.slice(0, itemsToShow).map(li => li.outerHTML).join('');
                }
            } else {
                const textContent = element.textContent;
                isOverflowing = textContent.length > limit;
                if (isOverflowing) {
                    let truncated = textContent.substr(0, limit);
                    let lastSpace = truncated.lastIndexOf(' ');
                    if (lastSpace > 0) {
                        truncated = truncated.substr(0, lastSpace);
                    }
                    shortHtml = truncated + '... ';
                }
            }

            // Always clean up existing button before adding a new one
            let existingMoreBtn = element.nextElementSibling;
            if (existingMoreBtn && existingMoreBtn.classList.contains('more-button')) {
                existingMoreBtn.remove();
            }

            if (isOverflowing) {
                element.innerHTML = shortHtml;
                const moreBtn = document.createElement('button');
                moreBtn.textContent = 'more';
                moreBtn.className = 'more-button';
                moreBtn.style.cssText = "display: inline; border: none; background: none; color: #8e8e8e; padding: 0 0 0 5px; cursor: pointer; font-weight: bold;";
                element.parentNode.insertBefore(moreBtn, element.nextSibling);

                moreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (moreBtn.textContent === 'more') {
                        element.innerHTML = fullHtml;
                        moreBtn.textContent = 'less';
                    } else {
                        element.innerHTML = shortHtml;
                        moreBtn.textContent = 'more';
                    }
                });
            } else {
                // If not overflowing, just ensure the full content is displayed.
                element.innerHTML = fullHtml;
            }
        });
    }
}

// Initialize the profile page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ProfilePage();
});

function closeErrorModal() {
    document.getElementById('errorModal').classList.remove('active');
    document.body.style.overflow = ''; // Restore scroll
}
