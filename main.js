class InstagramClone {

    constructor() {
        this.loggedInUser = null; // Renamed from this.user for clarity
        //.log('InstagramClone initializing...');
        this.baseUrl = 'http://localhost:8080';//'https://instagram-wnh3.onrender.com';
        this.currentTab = "feed";
        this.posts = [];
        this.stories = []; // New property for stories
        this.currentPostId = null;
        this.filesToCrop = [];
        this.croppedFiles = [];
        this.cropper = null;
        this.userProfile = {};
        this.currentUser = null;
        this.expandedReplies = new Set();
        this.isCroppingForStory = false; // New property to differentiate cropping purpose
        this.isPostingStory = false;
        this.reportTargetId = null; // New property to store the ID of the item being reported (post or user)
        this.reportType = null; // New property to store whether it's a 'post' or 'user' report

        // Story Modal Properties
        this.currentStoryIndex = 0;
        this.allStories = [];

        // Pagination for feed
        this.currentPage = 0;
        this.pageSize = 5;
        this.isLoadingPosts = false;
        this.hasMorePosts = true;

        // Add these properties to your constructor
        this.loggedInUserAvatar = '1.png'; // Will be updated when profile loads
        this.genericAvatar = '1.png'; // A generic fallback avatar
        this.defaultPostImage = '1.png'; // Will be updated when profile loads
        this.modalsInitialized = false;

        //.log('Initial state:', {
        //     baseUrl: this.baseUrl,
        //     currentTab: this.currentTab
        // });

        this.init();
        this.loadInitialData();
    }

    async init() {
        //.log('Initializing components...');
        try {
            this.setupEventListeners();
            this.setupPostClickListeners(); // Add post click delegation
            this.setupModal();
            this.setupCommentsModal();
            this.setupLikesModal();
            this.setupEditProfileModal();
            this.setupPostOptionsModal();
            this.setupReportOptionsModal(); // New: Setup report options modal
            this.setupReportDescriptionModal(); // New: Setup report description modal
            this.setupCropperModal();
            this.setupFollowRequestsModal();
            this.updateFollowRequestsDot(); // Call this after setup
            this.renderStories(); // Initial render of stories
            this.setupStoryModalEventListeners(); // From story-modal.js
            this.setupPeopleSuggestions();
            this.setupSearchBar(); // Setup search bar functionality
            //.log('Components initialized successfully');
        } catch (error) {
            //.error('Error during initialization:', error);
        }
    }

    async loadInitialData() {
        //.log('Loading initial data...');
        try {
            await this.loadUserProfile();
            await this.fetchAllStories(); // Fetch stories on initial load


            // Check if we need to open a specific post (from profile page)
            const postIdToOpen = localStorage.getItem('openPostId');
            const shouldOpenModal = localStorage.getItem('openPostModal');
            if (postIdToOpen && shouldOpenModal) {
                localStorage.removeItem('openPostId');
                localStorage.removeItem('openPostModal');
                setTimeout(() => {
                    const post = this.posts.find(p => p.stringID === postIdToOpen);
                    if (post) {
                        this.showPostModal(post);
                    }
                }, 1000); // Longer delay to ensure feed is fully loaded
            }

            //.log('Initial data loaded successfully');
        } catch (error) {
            //.error('Error loading initial data:', error);
        }
    }

    async loadUserProfile() {
        //.log('Loading user profile...');
        try {
            const response = await fetch(`${this.baseUrl}/user`, {
                credentials: 'include'
            });

            //.log('Profile response status:', response.status);

            if (response.status === 401 || response.status === 403) {
                //.warn('Unauthorized, redirecting to login...');
                window.location.href = 'login.html'; // Changed from /login.html
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.loggedInUser = await response.json();
            //.log('User profile loaded:', this.loggedInUser);

            this.userProfile = this.loggedInUser;
            this.currentUser = this.loggedInUser.username;

            this.updateFollowRequestsDot(); // Update dot after user profile is loaded
            // Update default avatar from user profile
            //.log('User profileAvatarID:', this.loggedInUser.profileAvatarID);
            if (this.loggedInUser.profileAvatarID) {
                try {
                    //.log(`Fetching avatar from: ${this.baseUrl}/files/get-files/file-id=${this.loggedInUser.profileAvatarID}`);
                    const avatarResponse = await fetch(`${this.baseUrl}/files/get-files/file-id=${this.loggedInUser.profileAvatarID}`, {
                        credentials: 'include'
                    });
                    //.log('Avatar response status:', avatarResponse.status);
                    if (avatarResponse.ok) {
                        const blob = await avatarResponse.blob();
                        this.loggedInUserAvatar = URL.createObjectURL(blob);
                        this.defaultPostImage = this.loggedInUserAvatar;
                        //.log('Avatar loaded successfully:', this.loggedInUserAvatar);

                        // Update profile display after avatar loads
                        this.updateProfileDisplay();
                    } else {
                        //.error('Failed to fetch avatar, status:', avatarResponse.status);
                    }
                } catch (e) {
                    //.warn('Failed to load user avatar:', e);
                }
            } else {
                //.log('User has no profileAvatarID, using default avatar');
                // Update profile display with default avatar
                this.updateProfileDisplay();
            }

            await this.loadFeed(true); // Load initial feed and reset pagination
        } catch (error) {
            //.error('Error loading user profile:', error);
            throw error;
        }
    }

    async fetchUserData(username) {
        try {
            const response = await fetch(`${this.baseUrl}/user/get-user/username=${encodeURIComponent(username)}`, {
                credentials: 'include'
            });
            // For locked profiles (423) or other errors, the body might still contain data.
            // We attempt to parse it regardless of the ok status.
            if (response.status === 404) return null; // User not found is a definite null.
            const userData = await response.json();
            if (response.status === 423) {
                userData.isLocked = true; // Ensure lock status is set
            }
            return userData;
        } catch (error) {
            //.error(`Error fetching data for user ${username}:`, error);
            return null;
        }
    }

    // New method to fetch common followers
    async fetchCommonFollowers(username) {
        try {
            const response = await fetch(`${this.baseUrl}/user/get-common-followers/user=${encodeURIComponent(username)}`, {
                credentials: 'include'
            });
            if (!response.ok) {
                if (response.status === 404) {
                    //.log(`No common followers found for ${username}.`);
                    return [];
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const commonFollowers = await response.json();
            //.log(commonFollowers, "common followe");
            return commonFollowers; // Assuming this returns an array of usernames
        } catch (error) {
            //.error(`Error fetching common followers for ${username}:`, error);
            return [];
        }
    }

    async loadFeed(reset = false) {
        if (this.isLoadingPosts || !this.hasMorePosts) {
            //.log('Already loading posts or no more posts to load.');
            return;
        }

        this.isLoadingPosts = true;
        const seeMoreBtn = document.getElementById('see-more-btn');
        if (seeMoreBtn) {
            seeMoreBtn.style.display = 'none';
        }
        const feedContainer = document.getElementById('feed-container');
        let loadingIndicator = document.getElementById('loading-posts-indicator');

        // Create loading indicator if it doesn't exist
        if (!loadingIndicator) {
            loadingIndicator = document.createElement('div');
            loadingIndicator.id = 'loading-posts-indicator';
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.innerHTML = `
                <div class="spinner"></div>
                <p>Loading posts...</p>
            `;
            document.body.appendChild(loadingIndicator); // Append to body or a more suitable parent
        }

        if (reset) {
            this.currentPage = 0;
            this.posts = [];
            if (feedContainer) {
                feedContainer.innerHTML = ''; // Clear existing posts only on reset
            }
            this.hasMorePosts = true;
        }

        // Determine position based on existing posts
        // This logic will be moved to after posts are fetched to ensure correct class application
        loadingIndicator.style.display = 'flex'; // Always show as flex for centering/bottom

        //.log(`Loading feed page ${this.currentPage} with size ${this.pageSize}...`);
        try {
            const response = await fetch(`${this.baseUrl}/user/blogs?page=${this.currentPage}&size=${this.pageSize}`, {
                credentials: 'include'
            });
            //.log('Feed response status:', response.status);
            if (response.status === 401 || response.status === 403) {
                //.warn('Unauthorized in loadFeed, redirecting to login...');
                window.location.href = 'login.html';
                return;
            }
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const blogs = await response.json();
            console.log('Blogs received from API:', blogs); // Added log

            if (blogs.length < this.pageSize) {
                this.hasMorePosts = false; // No more posts to load
            } else {
                this.currentPage++; // Increment page for next load
            }

            // For each blog, fetch all files and store their object URLs
            const newPosts = await Promise.all(blogs.map(async blog => {
                if (Array.isArray(blog.fileID)) {
                    blog.imageUrls = await Promise.all(blog.fileID.map(async fileObj => {
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
                    blog.imageUrls = [];
                }
                return blog;
            }));

            // Add new posts to the beginning of the array
            this.posts = [...newPosts, ...this.posts];

            // Now, determine if 'no-posts' class should be applied or removed
            if (this.posts.length === 0) {
                feedContainer.classList.add('no-posts');
                loadingIndicator.classList.add('centered');
                //.log('No posts found after load, displaying message.');
                feedContainer.innerHTML = `
                    <div class="no-posts-message">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="#dbdbdb" stroke-width="1.5">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="8.5" cy="7" r="4"></circle>
                            <line x1="20" y1="8" x2="20" y2="14"></line>
                            <line x1="23" y1="11" x2="17" y2="11"></line>
                        </svg>
                        <h2>No Posts Yet</h2>
                        <p>Start following people or create your first post!</p>
                    </div>
                `;
            } else {
                feedContainer.classList.remove('no-posts');
                loadingIndicator.classList.remove('centered');
                // Clear the "No posts yet" message if it was previously displayed
                const noPostsMessage = feedContainer.querySelector('.no-posts-message');
                if (noPostsMessage) {
                    noPostsMessage.remove();
                }
            }

            await this.renderFeed(newPosts); // Render only the new posts
        } catch (error) {
            //.error('Error loading feed:', error);
            this.hasMorePosts = false; // Stop trying to load if there's an error
        } finally {
            this.isLoadingPosts = false;
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
        }
    }

    checkIfUserLiked(item) {
        if (!item || !item.likedBy || !Array.isArray(item.likedBy)) {
            return false;
        }
        return item.likedBy.includes(this.currentUser);
    }

    updateProfileDisplay() {
        //.log('Updating profile display with:', this.userProfile);
        try {
            const headerProfilePic = document.getElementById('header-profile-pic');
            const profilePicLarge = document.getElementById('profile-pic-large');
            const profileUsername = document.getElementById('profile-username');
            const profileBio = document.getElementById('profile-bio');
            const postsCount = document.getElementById('posts-count');
            const followersCount = document.getElementById('followers-count');
            const followingCount = document.getElementById('following-count');

            // Only update elements that exist - use actual user avatar
            if (headerProfilePic) headerProfilePic.src = this.loggedInUserAvatar;
            if (profilePicLarge) profilePicLarge.src = this.loggedInUserAvatar;
            if (profileUsername) profileUsername.textContent = this.userProfile.username || '';
            if (profileBio) profileBio.textContent = this.userProfile.bio || '';
            if (postsCount) postsCount.textContent = this.userProfile.numberOfPosts || '0';
            if (followersCount) followersCount.textContent = this.userProfile.numberOfFollower || '0';
            if (followingCount) followingCount.textContent = this.userProfile.numberOfFollowings || '0';
        } catch (error) {
            //.error('Error updating profile display:', error);
        }
    }

    async renderFeed(postsToRender = []) { // Renamed newPosts to postsToRender for clarity
        //.log('Rendering feed with posts:', postsToRender);
        const container = document.getElementById('feed-container');
        if (!container) {
            //.error('Feed container not found!');
            return;
        }

        // Render posts by appending them (they are already sorted newest-first from backend)
        //.log('Posts to render:', postsToRender);
        for (const post of postsToRender) {
            const postElement = await this.createPostElement(post); // Use the new helper method
            container.appendChild(postElement);
            //.log('Appended post element to feed container:', post.stringID);
        }
    }

    // New helper method to create a single post element
    async createPostElement(post) {
        // Fetch likes, comments, liked state, saved state, following state and author avatar for each post
        const [likesList, commentsList, isSaved, isFollowing, authorAvatar, postAuthorData] = await Promise.all([
            this.fetchBlogLikes(post.stringID),
            this.fetchBlogComments(post.stringID),
            this.checkBlogSaved(post.stringID, this.loggedInUser),
            this.checkUserFollowing(post.author, this.loggedInUser),
            this.getUserAvatar(post.author),
            this.fetchUserData(post.author) // Fetch author data to check if locked
        ]);
        const isRequestSent = this.loggedInUser.sentRequests.includes(post.author);
        const isLiked = this.checkIfUserLiked(post);
        post.likesList = likesList;
        post.commentsList = commentsList;
        post.authorAvatar = authorAvatar;
        post.isSaved = isSaved;
        //.log('Post', post.stringID, 'saved status:', isSaved);

        // Set comment count directly from API response, filtering valid comments
        const validComments = commentsList.filter(comment =>
            comment &&
            comment.comment &&
            comment.author &&
            comment.comment.trim().length > 0
        );
        post.commentCount = validComments.length;

        const postElement = document.createElement('div');
        postElement.className = 'insta-post-card';
        postElement.setAttribute('data-post-id', post.stringID);

        // Modern Instagram-style card layout (share button removed)
        postElement.innerHTML = `
            <div class="post-header">
                <img src="${post.authorAvatar || this.genericAvatar}" class="post-avatar" alt="${post.author}">
                <div class="post-user-info">
                <span class="post-username">${post.author}</span>
                <span class="post-time-header">${await this.getTimeAgo(post.standardTime)}</span>
                
                </div>
                <div class="post-header-actions">
                ${post.author !== this.currentUser ? `
                <button 
                    class="post-follow-btn ${isFollowing ? 'following' : 'Follow'}" 
                    data-following="${isFollowing}" 
                    data-author="${post.author}"
                    data-is-locked="${postAuthorData?.isLocked || false}"
                    ${isRequestSent ? 'disabled' : ''}>
                    ${isFollowing ? 'Following' : (isRequestSent ? 'Requested' : 'Follow')}
                </button>
                ` : ''}
                    <button class="post-menu-btn" data-post-owner="${post.author === this.currentUser}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="1.5" fill="#262626"/>
                            <circle cx="12" cy="6" r="1.5" fill="#262626"/>
                            <circle cx="12" cy="18" r="1.5" fill="#262626"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="post-images-container">
                <div class="loading-placeholder">Loading images...</div>
            </div>
            <div class="post-actions">
                <div class="post-actions-left">
                    <button class="like-btn" data-liked="${isLiked}">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="${isLiked ? '#ff3040' : 'none'}" stroke="${isLiked ? '#ff3040' : '#262626'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                    </button>
                    <button class="comment-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                    </button>
                </div>
                <button class="save-btn" data-saved="${isSaved}">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="${isSaved ? '#0095f6' : 'none'}" stroke="${isSaved ? '#0095f6' : '#262626'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="19 21 12 17.27 5 21 5 3 19 3 19 21"/>
                    </svg>
                </button>
            </div>
            <div class="post-likes">
                <span class="like-count" style="cursor: pointer;">${likesList.length} likes</span>
            </div>
            ${post.caption ? `
            <div class="post-caption">
                <span class="caption-text" data-post-id="${post.stringID}">
                    <strong class="post-username-caption">${post.author}</strong> ${post.caption}
                </span>
            </div>` : ''}
            
           
            ${post.commentCount > 0 ? `<div class="view-all-comments-section">
                <span class="view-all-comments clickable">View all ${post.commentCount} comments</span>
            </div>` : ''}
            <!-- Comments preview hidden as requested -->
            <div class="post-comments-preview" data-post-id="${post.stringID}" style="display: none;">
                ${this.renderCommentsPreview(commentsList)}
            </div>

            <div class="post-comment-box">
                <input type="text" class="comment-input" placeholder="Add a comment...">
                <button class="post-comment-btn" disabled>Post</button>
            </div>
        `;

        //.log('Rendered save button for post', post.stringID, 'with saved state:', isSaved);

        // Make username clickable
        const usernameElement = postElement.querySelector('.post-username');
        this.makeUsernameClickable(usernameElement, post.author);

        // Add event listeners for like, comment, save, follow, and comment box
        const likeBtn = postElement.querySelector('.like-btn');
        const commentBtn = postElement.querySelector('.comment-btn');
        const saveBtn = postElement.querySelector('.save-btn');
        const followBtn = postElement.querySelector('.post-follow-btn');
        const likeCount = postElement.querySelector('.like-count');
        const commentInput = postElement.querySelector('.comment-input');
        const postCommentBtn = postElement.querySelector('.post-comment-btn');
        const viewAllComments = postElement.querySelector('.view-all-comments');

        // Optimistic like
        likeBtn.addEventListener('click', async () => {
            const currentlyLiked = likeBtn.getAttribute('data-liked') === 'true';
            const newLikedState = !currentlyLiked;

            // Optimistically update UI
            likeBtn.setAttribute('data-liked', String(newLikedState));
            const svg = likeBtn.querySelector('svg');
            svg.setAttribute('fill', newLikedState ? '#ff3040' : 'none');
            svg.setAttribute('stroke', newLikedState ? '#ff3040' : '#262626');
            let likeNum = parseInt(likeCount.textContent) || 0;
            likeNum = newLikedState ? likeNum + 1 : Math.max(0, likeNum - 1);
            likeCount.textContent = `${likeNum} likes`;

            try {
                let response;
                if (newLikedState) {
                    const now = new Date();
                    const localTime = now.toString();
                    response = await fetch(`${this.baseUrl}/user/add-likes/${post.stringID}`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ standardTime: localTime })
                    });
                } else {
                    const likeId = await this.getCurrentUserLikeId(post.stringID);
                    if (likeId) {
                        response = await fetch(`${this.baseUrl}/user/delete-like/like-id=${likeId}`, { method: 'DELETE', credentials: 'include' });
                    } else {
                        response = new Response(null, { status: 200 }); // Already unliked
                    }
                }

                if (!response.ok) throw new Error('API call failed');

                // On success, update the local data model
                if (newLikedState) {
                    if (!post.likedBy.includes(this.currentUser)) {
                        post.likedBy.push(this.currentUser);
                    }
                } else {
                    const index = post.likedBy.indexOf(this.currentUser);
                    if (index > -1) {
                        post.likedBy.splice(index, 1);
                    }
                }

            } catch (e) {
                // Revert UI on error
                likeBtn.setAttribute('data-liked', String(currentlyLiked));
                svg.setAttribute('fill', currentlyLiked ? '#ff3040' : 'none');
                svg.setAttribute('stroke', currentlyLiked ? '#ff3040' : '#262626');
                likeCount.textContent = `${currentlyLiked ? likeNum - 1 : likeNum + 1} likes`;
            }
        });
        likeCount.addEventListener('click', () => {
            this.showLikesModal(post.stringID);
        });
        commentBtn.addEventListener('click', () => {
            this.showCommentsModal(post.stringID);
        });
        saveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            //.log('Save button clicked for post:', post.stringID);
            await this.toggleSavePost(post.stringID, saveBtn);
        });

        // Follow button event listener
        if (followBtn) {
            followBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const author = followBtn.getAttribute('data-author');
                await this.toggleFeedFollow(author, followBtn);
            });
        }
        if (viewAllComments) {
            viewAllComments.addEventListener('click', () => {
                this.showCommentsModal(post.stringID);
            });
        }
        commentInput.addEventListener('input', () => {
            postCommentBtn.disabled = commentInput.value.trim().length === 0;
        });

        // Add enter key support for commenting
        commentInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (commentInput.value.trim()) {
                    const commentText = commentInput.value.trim();
                    commentInput.value = '';
                    postCommentBtn.disabled = true;

                    // Optimistically add comment to preview
                    const previewDiv = postElement.querySelector('.post-comments-preview');
                    const viewAllSection = postElement.querySelector('.view-all-comments-section');

                    // Update comment count
                    post.commentCount++;

                    // Show/update "View all comments" section
                    if (viewAllSection) {
                        const viewAllSpan = viewAllSection.querySelector('.view-all-comments');
                        viewAllSpan.textContent = `View all ${post.commentCount} comments`;
                    } else {
                        // Create new view all section if it doesn't exist
                        const newViewAllSection = document.createElement('div');
                        newViewAllSection.className = 'view-all-comments-section';
                        newViewAllSection.innerHTML = `<span class="view-all-comments clickable">View all ${post.commentCount} comments</span>`;
                        previewDiv.parentNode.insertBefore(newViewAllSection, previewDiv);

                        // Add event listener to the new element
                        newViewAllSection.querySelector('.view-all-comments').addEventListener('click', () => {
                            this.showCommentsModal(post.stringID);
                        });
                    }

                    const timeAgo = await this.getTimeAgo(new Date());
                    const newCommentHtml = `
                    <div class="comment-preview">
                        <div class="comment-preview-line1">
                            <span class="comment-username">${this.currentUser}</span>
                            <span class="comment-time">${timeAgo}</span>
                        </div>
                        <div class="comment-preview-line2">${commentText}</div>
                    </div>`;
                    previewDiv.innerHTML += newCommentHtml;

                    try {
                        const now = new Date();
                        const localTime = now.toISOString();
                        await fetch(`${this.baseUrl}/user/add-comment/${post.stringID}`, {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ comment: commentText, standardTime: localTime })
                        });
                    } catch (e) {
                        //.log(e);
                    }
                }
            }
        });
        postCommentBtn.addEventListener('click', async () => {
            if (commentInput.value.trim()) {
                const commentText = commentInput.value.trim();
                commentInput.value = '';
                postCommentBtn.disabled = true;

                // Optimistically add comment to preview
                const previewDiv = postElement.querySelector('.post-comments-preview');
                const viewAllSection = postElement.querySelector('.view-all-comments-section');

                // Update comment count
                post.commentCount++;

                // Show/update "View all comments" section
                if (viewAllSection) {
                    const viewAllSpan = viewAllSection.querySelector('.view-all-comments');
                    viewAllSpan.textContent = `View all ${post.commentCount} comments`;
                } else {
                    // Create new view all section if it doesn't exist
                    const newViewAllSection = document.createElement('div');
                    newViewAllSection.className = 'view-all-comments-section';
                    newViewAllSection.innerHTML = `<span class="view-all-comments clickable">View all ${post.commentCount} comments</span>`;
                    previewDiv.parentNode.insertBefore(newViewAllSection, previewDiv);

                    // Add event listener to the new element
                    newViewAllSection.querySelector('.view-all-comments').addEventListener('click', () => {
                        this.showCommentsModal(post.stringID);
                    });
                }

                const timeAgo = await this.getTimeAgo(new Date());
                const newCommentHtml = `
                <div class="comment-preview">
                    <div class="comment-preview-line1">
                        <span class="comment-username">${this.currentUser}</span>
                        <span class="comment-time">${timeAgo}</span>
                    </div>
                    <div class="comment-preview-line2">${commentText}</div>
                </div>`;
                previewDiv.innerHTML += newCommentHtml;

                try {
                    const now = new Date();
                    const localTime = now.toISOString();
                    await fetch(`${this.baseUrl}/user/add-comment/${post.stringID}`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ comment: commentText, standardTime: localTime })
                    });
                } catch (e) {
                    //.log(e);
                }
            }
        });

        // Load images in parallel
        this.loadPostImagesOptimized(post, postElement);
        this.setupCaption(postElement);
        return postElement; // Return the created element
    }

    async loadPostImagesOptimized(post, postElement) {
        const imagesContainer = postElement.querySelector('.post-images-container');
        try {
            const imageUrls = post.imageUrls || [];
            if (imageUrls.length > 0) {
                const carouselHtml = `
                    <div class="post-carousel">
                        ${imageUrls.map((url, i) => `
                            <div class="carousel-slide ${i === 0 ? 'active' : ''}">
                                <img src="${url}" alt="Post image ${i + 1}">
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
                imagesContainer.innerHTML = carouselHtml;
                if (imageUrls.length > 1) {
                    this.initializeCarousel(postElement, post.stringID);
                }
            } else {
                imagesContainer.innerHTML = '<div class="error-message">No images found</div>';
            }
        } catch (error) {
            //.error('Error loading images:', error);
            imagesContainer.innerHTML = '<div class="error-message">Failed to load images</div>';
        }
    }

    initializeCarousel(postElement, postId) {
        const carousel = postElement.querySelector('.post-carousel');
        const prevBtn = carousel.querySelector('.carousel-prev');
        const nextBtn = carousel.querySelector('.carousel-next');
        const dots = carousel.querySelectorAll('.dot');
        const shareBtn = carousel.querySelector('.share-btn');
        const saveBtn = carousel.querySelector('.save-btn');
        prevBtn?.addEventListener('click', () => this.previousSlide(postId, postElement));
        nextBtn?.addEventListener('click', () => this.nextSlide(postId, postElement));
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => this.goToSlide(postId, index, postElement));
        });

        saveBtn?.addEventListener('click', () => {
            // Save logic here
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
    async createPost(files, caption) {
        try {
            //.log('Creating new post...');

            // Step 1: Upload files
            const fileIDs = [];
            for (const file of files) {
                //.log('Uploading file:', file.name);
                const formData = new FormData();
                formData.append('file', file);

                const uploadResponse = await fetch(`${this.baseUrl}/files/upload-files`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });

                if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text();
                    //.error('File upload failed:', errorText);
                    throw new Error('File upload failed');
                }

                const fileData = await uploadResponse.json();
                //.log('File upload successful:', fileData);
                fileIDs.push(fileData.stringID);
            }

            // Step 2: Create blog post
            const now = new Date();
            const localTime = now.toISOString();
            const blogData = {
                caption: caption,
                fileID: fileIDs,
                standardTime: localTime
            };


            console.log('Sending blog data:', blogData);

            const blogResponse = await fetch(`${this.baseUrl}/user/new-blog`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Origin': window.location.origin
                },
                body: JSON.stringify(blogData)
            });

            if (!blogResponse.ok) {
                const errorText = await blogResponse.text();
                console.error('Blog creation failed:', errorText);
                throw new Error(`Failed to create blog post: ${errorText}`);
            }

            const newPostData = await blogResponse.json(); // Get the newly created post data
            //.log('Blog post created successfully');
            const enrichedNewPost = await this.enrichPostData(newPostData); // Enrich with images, likes, comments etc.
            this.posts.unshift(enrichedNewPost); // Add to the beginning of the local posts array

            // Manually render and prepend the single new post to the feed container
            const feedContainer = document.getElementById('feed-container');
            if (feedContainer) {
                const postElement = await this.createPostElement(enrichedNewPost); // Create the post element
                feedContainer.prepend(postElement); // Prepend it to the DOM
                // Ensure 'no-posts' message is removed if this is the first post
                feedContainer.classList.remove('no-posts');
                const noPostsMessage = feedContainer.querySelector('.no-posts-message');
                if (noPostsMessage) {
                    noPostsMessage.remove();
                }
            }

        } catch (error) {
            //.error('Error in createPost:', error);
            throw error;
        }
    }

    async enrichPostData(blog) {
        if (Array.isArray(blog.fileID)) {
            blog.imageUrls = await Promise.all(blog.fileID.map(async fileObj => {
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
            blog.imageUrls = [];
        }
        // Fetch likes, comments, liked state, saved state, following state and author avatar for the post
        const [likesList, commentsList, isSaved, isFollowing, authorAvatar, postAuthorData] = await Promise.all([
            this.fetchBlogLikes(blog.stringID),
            this.fetchBlogComments(blog.stringID),
            this.checkBlogSaved(blog.stringID, this.loggedInUser),
            this.checkUserFollowing(blog.author, this.loggedInUser),
            this.getUserAvatar(blog.author),
            this.fetchUserData(blog.author) // Fetch author data to check if locked
        ]);
        const isRequestSent = this.loggedInUser.sentRequests.includes(blog.author);
        const isLiked = this.checkIfUserLiked(blog); // This might need to be updated if likedBy is not in the initial blog object
        blog.likesList = likesList;
        blog.commentsList = commentsList;
        blog.authorAvatar = authorAvatar;
        blog.isSaved = isSaved;
        blog.isLiked = isLiked; // Add isLiked to the post object
        blog.isFollowing = isFollowing; // Add isFollowing to the post object
        blog.isRequestSent = isRequestSent; // Add isRequestSent to the post object
        blog.postAuthorData = postAuthorData; // Add author data

        // Set comment count directly from API response, filtering valid comments
        const validComments = commentsList.filter(comment =>
            comment &&
            comment.comment &&
            comment.author &&
            comment.comment.trim().length > 0
        );
        blog.commentCount = validComments.length;

        return blog;
    }

    async addComment(postId, text) {
        try {
            //.log('addComment called with:', { postId, text });
            // Send API request
            const now = new Date();
            const localTime = now.toISOString();
            const response = await fetch(`${this.baseUrl}/user/add-comment/${postId}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: text, standardTime: localTime })
            });
            //.log('addComment response:', response);
            if (!response.ok) throw new Error('Failed to add comment');

            // Remove "No comments yet" message if it exists
            const commentsContainer = document.querySelector('.comments-container');
            const noCommentsDiv = commentsContainer?.querySelector('.no-comments');
            if (noCommentsDiv) {
                noCommentsDiv.remove();
            }

            // Update comment count in the post object
            const post = this.posts.find(p => p.stringID === postId);
            if (post) {
                post.commentCount++;

                // Update the "View all comments" section in the post
                const postElement = document.querySelector(`[data-post-id="${postId}"]`);
                if (postElement) {
                    const viewAllSection = postElement.querySelector('.view-all-comments-section');
                    if (viewAllSection) {
                        const viewAllSpan = viewAllSection.querySelector('.view-all-comments');
                        viewAllSpan.textContent = `View all ${post.commentCount} comments`;
                    } else if (post.commentCount === 1) {
                        // Create new view all section if this is the first comment
                        const previewDiv = postElement.querySelector('.post-comments-preview');
                        const newViewAllSection = document.createElement('div');
                        newViewAllSection.className = 'view-all-comments-section';
                        newViewAllSection.innerHTML = `<span class="view-all-comments clickable">View all ${post.commentCount} comments</span>`;
                        previewDiv.parentNode.insertBefore(newViewAllSection, previewDiv);

                        // Add event listener to the new element
                        newViewAllSection.querySelector('.view-all-comments').addEventListener('click', () => {
                            this.showCommentsModal(postId);
                        });
                    }
                }
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

    async addReply(postId, commentId, text) {
        try {
            //.log('addReply called with:', { postId, commentId, text });
            const now = new Date();
            const localTime = now.toISOString();
            const response = await fetch(`${this.baseUrl}/user/reply-comment/cmnt-id=${commentId}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: text, standardTime: localTime })
            });
            if (!response.ok) throw new Error('Failed to add reply');
            // Optimistically add the new reply to the correct replies container
            const newReply = await response.json();
            // Find the parent comment's replies container
            const parentCommentDiv = document.querySelector(`.comment-tree-item[data-comment-id="${commentId}"]`);
            if (parentCommentDiv && newReply && newReply.stringID) {
                const repliesContainer = parentCommentDiv.querySelector('.replies-container');
                if (repliesContainer) {
                    const replyElement = await this.createCommentTree(newReply, (parseInt(parentCommentDiv.getAttribute('data-depth')) || 0) + 1, postId);
                    if (replyElement) {
                        repliesContainer.prepend(replyElement);
                    }
                }
            }
        } catch (error) {
            //.error('Error adding reply:', error);
        }
    }

    findCommentById(comments, commentId) {
        for (const comment of comments) {
            if (comment.commentId === commentId) return comment;
            if (comment.replies) {
                const found = this.findCommentById(comment.replies, commentId);
                if (found) return found;
            }
        }
        return null;
    }

    // New method to set up search bar functionality
    setupSearchBar() {
        const searchInput = document.getElementById('search-input');
        const searchResultsModal = document.getElementById('search-results-modal');
        const searchResultsList = document.getElementById('search-results-list');

        if (!searchInput || !searchResultsModal || !searchResultsList) {
            //.warn('Search bar elements not found.');
            return;
        }

        let searchTimeout;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(searchTimeout);
            if (query.length > 0) {
                searchResultsModal.classList.add('active');
                searchTimeout = setTimeout(() => this.searchPeople(query), 300); // Debounce search
            } else {
                searchResultsModal.classList.remove('active');
                searchResultsList.innerHTML = ''; // Clear results when input is empty
            }
        });

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchResultsModal.contains(e.target)) {
                searchResultsModal.classList.remove('active');
            }
        });
    }

    // New method to search for people
    async searchPeople(query) {
        const searchResultsList = document.getElementById('search-results-list');
        if (!searchResultsList) return;

        searchResultsList.innerHTML = '<div class="loading-indicator">Searching...</div>';

        try {
            const response = await fetch(`${this.baseUrl}/user/search-people/user=${encodeURIComponent(query)}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 404) {
                    searchResultsList.innerHTML = '<div class="no-results">No users found.</div>';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const users = await response.json();
            searchResultsList.innerHTML = ''; // Clear loading indicator

            if (users.length === 0) {
                searchResultsList.innerHTML = '<div class="no-results">No users found.</div>';
                return;
            }

            for (const user of users) {
                const userElement = document.createElement('div');
                userElement.className = 'search-result-item';

                const avatarUrl = await this.getUserAvatar(user.username);
                const commonFollowers = await this.fetchCommonFollowers(user.username);
                let followedByText = '';

                if (commonFollowers.length > 0) {
                    const firstCommonFollower = commonFollowers[0];
                    if (commonFollowers.length === 1) {
                        followedByText = `<span class="followed-by-text">Followed by <span>${firstCommonFollower.username}</span></span>`;

                    } else {
                        followedByText = `<span class="followed-by-text">Followed by <span> ${firstCommonFollower.username} </span> and ${commonFollowers.length - 1} others</span>`;
                    }
                }

                userElement.innerHTML = `
                    <img src="${avatarUrl}" alt="${user.username}" class="search-result-avatar" />
                    
                    <div class="search-result-info">
                        <span class="search-result-username">${user.username}</span>
                        ${followedByText}
                    </div>
                `;

                userElement.addEventListener('click', () => {
                    this.openProfile(user.username);
                    document.getElementById('search-results-modal').classList.remove('active');
                    document.getElementById('search-input').value = '';
                });
                searchResultsList.appendChild(userElement);
            }

        } catch (error) {
            //.error('Error searching for people:', error);
            searchResultsList.innerHTML = '<div class="error-message">Failed to load search results.</div>';
        }
    }

    // Asynchronous function to handle image selection
    // Asynchronous function to handle image selection for posts
    async handleImageSelection(files) {
        this.filesToCrop = Array.from(files);
        this.croppedFiles = [];
        document.getElementById('selected-images').innerHTML = ''; // Clear previous previews
        this.isCroppingForStory = this.isPostingStory; // Set based on the current mode

        if (this.filesToCrop.length > 0) {
            this.showCropperForNextFile();
        }
    }


    showCropperForNextFile() {
        if (this.filesToCrop.length === 0) {
            // All files have been processed
            const cropperModal = document.getElementById('cropper-modal');
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
            const cropperModal = document.getElementById('cropper-modal');
            const cropperImage = document.getElementById('cropper-image');
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
        const modal = document.getElementById('cropper-modal');
        const cropBtn = document.getElementById('crop-btn');
        const selectedImagesDiv = document.getElementById('selected-images'); // This is for post previews

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                // If user closes cropper modal without cropping all files, clear filesToCrop
                this.filesToCrop = [];
                this.croppedFiles = [];
                this.isCroppingForStory = false; // Reset flag
            }
        });

        cropBtn.addEventListener('click', () => {
            if (!this.cropper) return;

            const canvas = this.cropper.getCroppedCanvas({
                width: 1200, // Increased size
                height: 1200, // Increased size
                imageSmoothingQuality: 'high',
            });

            canvas.toBlob((blob) => {
                const file = new File([blob], `cropped_${this.croppedFiles.length}.jpg`, { type: 'image/jpeg' });
                this.croppedFiles.push(file);

                // Only update preview for posts
                if (!this.isCroppingForStory) {
                    this.updateSelectedImagesPreview();
                }

                // Process the next file
                this.showCropperForNextFile();

            }, 'image/jpeg');
        });
    }

    updateSelectedImagesPreview() {
        const selectedImagesDiv = document.getElementById('selected-images');
        selectedImagesDiv.innerHTML = ''; // Clear and re-render

        this.croppedFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgWrapper = document.createElement('div');
                imgWrapper.className = 'selected-image';
                imgWrapper.innerHTML = `
                    <img src="${e.target.result}" alt="Selected ${index + 1}">
                    <button class="remove-image" data-index="${index}">×</button>
                    <div class="image-size">${this.formatFileSize(file.size)}</div>
                `;
                selectedImagesDiv.appendChild(imgWrapper);
                imgWrapper.querySelector('.remove-image').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const indexToRemove = parseInt(e.target.dataset.index);
                    this.croppedFiles.splice(indexToRemove, 1);
                    this.updateSelectedImagesPreview(); // Re-render after removal
                });
            };
            reader.readAsDataURL(file);
        });
    }

    async optimizeImage(file) {
        if (!file.type.match('image.*')) {
            //.warn('Skipping non-image file:', file.name);
            return null;
        }

        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Calculate optimal dimensions (max 1080px for Instagram-like quality)
                const maxDimension = 1080;
                let { width, height } = img;

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = (height * maxDimension) / width;
                        width = maxDimension;
                    } else {
                        width = (width * maxDimension) / height;
                        height = maxDimension;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to blob with compression
                canvas.toBlob((blob) => {
                    if (blob) {
                        // Create a new File object with the optimized blob
                        const optimizedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        //.log(`Optimized ${file.name}: ${this.formatFileSize(file.size)} → ${this.formatFileSize(optimizedFile.size)}`);
                        resolve(optimizedFile);
                    } else {
                        resolve(file);
                    }
                }, 'image/jpeg', 0.85); // 85% quality for good compression
            };

            img.onerror = () => {
                //.error('Failed to load image:', file.name);
                resolve(file);
            };

            img.src = URL.createObjectURL(file);
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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


    renderCommentsPreview(commentsList) {
        // Only show actual comments, never show "No comments yet" in post preview
        const validComments = commentsList.filter(comment =>
            comment &&
            comment.comment &&
            comment.author &&
            comment.comment.trim().length > 0
        );

        return validComments.slice(0, 2).map(comment => {
            // Ensure comment.time is a valid date string before passing to getTimeAgo
  
            const timeAgo =  this.getTimeAgo(comment.standardTime) || 'Unknown time';
            return `
            <div class="comment-preview">
                <div class="comment-preview-line1">
                    <span class="comment-username">${comment.author}</span>
                    <span class="comment-time">${timeAgo}</span>
                </div>
                <div class="comment-preview-line2">${comment.comment}</div>
            </div>`;
        }).join('');
    }
    updateImageIndices(container) {
        const images = container.querySelectorAll('.selected-image');
        images.forEach((img, newIndex) => {
            const removeBtn = img.querySelector('.remove-image');
            removeBtn.dataset.index = newIndex;
        });
    }
    setupModal() {
        const modal = document.getElementById('create-post-modal');
        const openBtn = document.getElementById('create-post-btn');
        const fileUploadContainer = document.querySelector('.file-upload-container');
        const selectFilesBtn = document.querySelector('.select-files-btn');
        const imageInput = document.getElementById('image-input');
        const selectedImagesDiv = document.getElementById('selected-images');
        const captionInput = document.getElementById('caption-input');
        const shareBtn = document.getElementById('share-btn'); // Fixed ID mismatch

        if (!modal || !openBtn || !imageInput || !selectedImagesDiv || !captionInput || !shareBtn) {
            //.warn('Modal elements not found:', {

            return;
        }

        // Function to close modal
        const closeModal = () => {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            this.resetModal();
        };

        // Open modal
        openBtn.addEventListener('click', () => {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });

        // FIXED: File selection - both click on container and button
        const triggerFileSelection = () => {
            imageInput.click();
        };

        fileUploadContainer.addEventListener('click', triggerFileSelection);
        selectFilesBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent double triggering
            triggerFileSelection();
        });

        // Drag and drop functionality
        fileUploadContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadContainer.classList.add('drag-over');
        });

        fileUploadContainer.addEventListener('dragleave', () => {
            fileUploadContainer.classList.remove('drag-over');
        });

        fileUploadContainer.addEventListener('drop', async (e) => {
            e.preventDefault();
            fileUploadContainer.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files);
            await this.handleImageSelection(files);
        });

        // FIXED: File input change handler
        imageInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                await this.handleImageSelection(files);
            }
        });

        // FIXED: Share button functionality
        shareBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            if (!this.croppedFiles || this.croppedFiles.length === 0) {
                this.showError('Please select at least one image to post.');
                return;
            }
            if (this.croppedFiles.length > 5) {
                this.showError('You can only upload a maximum of 5 images per post.');
                return;
            }

            shareBtn.disabled = true;
            shareBtn.textContent = 'Posting...';

            try {
                if (this.isPostingStory) {
                    await this.postStoryWithCroppedFile(this.croppedFiles[0]);
                } else {
                    await this.createPost(this.croppedFiles, captionInput.value.trim());
                }
                closeModal();
                this.showSuccess(this.isPostingStory ? 'Story posted successfully!' : 'Post created successfully!');

            } catch (error) {
                //.error('Error creating post:', error);
                this.showError('Failed to create post. Please try again.');
            } finally {
                shareBtn.disabled = false;
                shareBtn.textContent = 'Share';
            }
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                closeModal();
            }
        });
    }
    resetModal() {
        // Clear selected files
        this.croppedFiles = [];
        this.filesToCrop = [];
        this.isPostingStory = false;

        const modal = document.getElementById('create-post-modal');
        const modalTitle = modal.querySelector('.modal-header h2');
        if (modalTitle) modalTitle.textContent = 'Create New Post';

        // Clear image input
        const imageInput = document.getElementById('image-input');
        if (imageInput) {
            imageInput.value = '';
        }

        // Clear selected images display
        const selectedImagesDiv = document.getElementById('selected-images');
        if (selectedImagesDiv) {
            selectedImagesDiv.innerHTML = '';
        }

        // Clear caption and show container
        const captionInput = document.getElementById('caption-input');
        const captionContainer = document.querySelector('.caption-container');
        if (captionInput) {
            captionInput.value = '';
        }
        if (captionContainer) {
            captionContainer.style.display = '';
        }

        // Reset share button
        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) {
            shareBtn.disabled = false;
            shareBtn.textContent = 'Share';
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

        // Handle comment input
        const handleCommentInput = () => {
            submitComment.disabled = commentInput.value.trim() === '';
            // Auto-resize textarea
            commentInput.style.height = 'auto';
            commentInput.style.height = Math.min(commentInput.scrollHeight, 80) + 'px';
        };

        // Initialize submit button state
        commentInput.addEventListener('input', handleCommentInput);
        handleCommentInput();

        // Robust close button event
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

        // Robust modal backdrop close
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                modal.classList.remove('active');
                document.body.style.overflow = '';
                this.currentPostId = null;
                //.log('Modal closed by backdrop click');
            }
        };

        // Prevent clicks inside modal content from closing modal
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.onclick = (e) => {
                e.stopPropagation();
            };
        }

        // Handle comment like button clicks using event delegation
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
                }
                // --- End Optimistic UI Update ---

                likeBtn.disabled = true;
                try {
                    let response;
                    if (newLikedState) {
                        // User is liking the comment
                        response = await fetch(`${this.baseUrl}/user/like-comment/cmnt-id=${commentId}`, {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },

                        });
                    } else {
                        // User is unliking the comment
                        response = await fetch(`${this.baseUrl}/user/delete-cmntlike/cmnt-id=${commentId}`, {
                            method: 'DELETE',
                            credentials: 'include'
                        });
                    }

                    if (!response.ok) {
                        throw new Error(`Failed to update like status: ${response.statusText}`);
                    }

                    // Success, the optimistic update was correct.
                    // For maximum safety, we can re-sync with the server's response


                } catch (error) {
                    //.error('Error toggling comment like:', error);
                    // Revert UI on error
                    likeBtn.setAttribute('data-liked', String(isCurrentlyLiked));
                    if (svg) {
                        svg.setAttribute('fill', isCurrentlyLiked ? '#ff3040' : 'none');
                    }
                    if (likeCountEl) {
                        likeCountEl.textContent = currentLikes;
                    }
                } finally {
                    likeBtn.disabled = false;
                }
            }
        });

        // Post comment on Enter (Shift+Enter for new line)
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
                        commentInput.value = '';
                        commentInput.style.height = '36px'; // Reset height
                    } catch (error) {
                        //.error('Error posting comment:', error);
                    } finally {
                        commentInput.disabled = false;
                        submitComment.disabled = false;
                        submitComment.textContent = 'Post';
                        handleCommentInput();
                    }
                }
            }
        };

        // Post button click handler
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
                    commentInput.value = '';
                    commentInput.style.height = '36px'; // Reset height
                } finally {
                    commentInput.disabled = false;
                    submitComment.disabled = false;
                    submitComment.textContent = 'Post';
                }
            }
        };

        // Close modal with Escape key
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

    setupLikesModal() {
        //.log('Setting up likes modal...');
        const modal = document.getElementById('likes-modal');

        if (!modal) {
            //.warn('Likes modal not found');
            return;
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

    // Show error with message
    async showError(message) {
        document.getElementById('errorModalMessage').textContent = message;
        document.getElementById('errorModal').classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scroll
    }

    // Close error modal
    closeErrorModal() {
        document.getElementById('errorModal').classList.remove('active');
        document.body.style.overflow = ''; // Restore scroll
    }

    // Show success with message
    async showSuccess(message) {
        document.getElementById('successModalMessage').textContent = message;
        const successModal = document.getElementById('successModal');
        successModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scroll

        const closeBtn = successModal.querySelector('.success-close-btn');
        const okBtn = successModal.querySelector('.success-btn');

        const closeModal = () => {
            successModal.classList.remove('active');
            document.body.style.overflow = ''; // Restore scroll
        };

        closeBtn.onclick = closeModal;
        okBtn.onclick = closeModal;
        successModal.onclick = (e) => {
            if (e.target === successModal) {
                closeModal();
            }
        };
    }

    async renderLikeUser(username, profileAvatarID, container) {
        try {
            // Fetch user profile to get avatar
            let avatarUrl = this.genericAvatar;

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

    scrollToPost(postId) {
        //.log('Scrolling to post:', postId);
        const postElement = document.querySelector(`[data-post-id="${postId}"]`);
        if (postElement) {
            postElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });

            // Add a highlight effect
            postElement.style.transition = 'box-shadow 0.3s ease';
            postElement.style.boxShadow = '0 0 20px rgba(0, 149, 246, 0.5)';
            setTimeout(() => {
                postElement.style.boxShadow = '';
            }, 2000);
        } else {
            //.warn('Post element not found for ID:', postId);
        }
    }

    async showPostModal(post) {
        try {

            const img = new Image();
            img.src = post.imageUrls[0];


            const [likesList, commentsList, isLiked, isSaved, authorAvatar] = await Promise.all([
                this.fetchBlogLikes(post.stringID),
                this.fetchBlogComments(post.stringID),
                this.checkBlogLiked(post, this.loggedInUser),
                this.checkBlogSaved(post.stringID, this.loggedInUser),
                this.getUserAvatar(post.author)
            ]);

            const modal = document.getElementById('post-modal');
            if (!modal) {
                //.error('Post modal not found in DOM');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 10));

            const modalImageContainer = modal.querySelector('.post-modal-image-container');

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

            if (!followBtn) {
                //.warn('Follow button not found in modal');
            }
            if (!likeBtn) {
                //.warn('Like button not found in modal');
            }
            if (!saveBtn) {
                //.warn('Save button not found in modal');
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
            if (modalAvatar) modalAvatar.src = authorAvatar || this.genericAvatar;
            if (modalAvatar) modalAvatar.src = authorAvatar || this.genericAvatar;
            if (modalUsername) modalUsername.textContent = post.author;
            if (modalCaptionAvatar) modalCaptionAvatar.src = authorAvatar || this.genericAvatar;
            if (modalCaptionUsername) modalCaptionUsername.textContent = post.author;
            if (modalCaptionText) {
                modalCaptionText.textContent = post.caption || '';
                const moreButton = modal.querySelector('.more-button');
                if (moreButton) {
                    // Use a timeout to allow the DOM to update
                    setTimeout(() => {
                        if (modalCaptionText.scrollHeight > modalCaptionText.clientHeight) {
                            moreButton.style.display = 'inline';
                        } else {
                            moreButton.style.display = 'none';
                        }
                    }, 0);
                }
            }
            if (modalCaptionTime) modalCaptionTime.textContent = await this.getTimeAgo(post.standardTime);
            if (modalLikes) modalLikes.textContent = `${likesList.length} likes`;
            if (modalTime) modalTime.textContent = await this.getTimeAgo(new Date(post.standardTime));

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
                    const postAuthorData = await this.fetchUserData(post.author);
                    const isFollowing = await this.checkUserFollowing(post.author, this.loggedInUser);
                    const isRequestSent = this.loggedInUser.sentRequests.includes(post.author);

                    followBtn.setAttribute('data-following', isFollowing);
                    followBtn.setAttribute('data-is-locked', postAuthorData?.isLocked || false);
                    followBtn.setAttribute('data-is-request-sent', isRequestSent);

                    if (isFollowing) {
                        followBtn.textContent = 'Following';
                        followBtn.className = 'post-modal-following-btn';
                        followBtn.disabled = false;
                    } else if (isRequestSent) {
                        followBtn.textContent = 'Requested';
                        followBtn.className = 'post-modal-follow-btn requested';
                        followBtn.disabled = true;
                    } else {
                        followBtn.textContent = 'Follow';
                        followBtn.className = 'post-modal-follow-btn';
                        followBtn.disabled = false;
                    }
                }
            } else {
                //.warn('Follow button not found in modal');
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

    async setupPostModalEventListeners(modal, postId, post) {
        const userInfo = modal.querySelector('.post-modal-user-info');
        const captionUsername = modal.querySelector('.post-modal-caption-username');
        const likesModal = modal.querySelector('.post-modal-likes');
        const likeBtn = modal.querySelector('.post-modal-like-btn');
        const commentBtn = modal.querySelector('.post-modal-comment-btn');
        const saveBtn = modal.querySelector('.post-modal-save-btn');
        const followBtn = modal.querySelector('.post-modal-follow-btn') || modal.querySelector('.post-modal-following-btn');
        const closeBtn = modal.querySelector('.close-post-modal');
        const commentInput = modal.querySelector('.post-modal-comment-input');
        const commentPostBtn = modal.querySelector('.post-modal-comment-post');
            const menuBtn = modal.querySelector('.post-menu-btn');
            const moreButton = modal.querySelector('.more-button');

            // Set data-post-owner attribute for the menu button in the modal
            if (menuBtn) {
                menuBtn.setAttribute('data-post-owner', post.author === this.currentUser);
            }

            if (userInfo) {
                const newUserInfo = userInfo.cloneNode(true);
                userInfo.parentNode.replaceChild(newUserInfo, userInfo);
                newUserInfo.addEventListener('click', () => {
                    this.openProfile(post.author);
                });
            }

        if (captionUsername) {
            const newCaptionUsername = captionUsername.cloneNode(true);
            captionUsername.parentNode.replaceChild(newCaptionUsername, captionUsername);
            newCaptionUsername.addEventListener('click', () => {
                this.openProfile(post.author);
            });
        }
        if (menuBtn) {
            const newMenuBtn = menuBtn.cloneNode(true);
            menuBtn.parentNode.replaceChild(newMenuBtn, menuBtn);
            newMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openReportOptionsModal(post.author, postId, e);
            });
        }

        if (moreButton) {
            const newMoreButton = moreButton.cloneNode(true);
            moreButton.parentNode.replaceChild(newMoreButton, moreButton);
            newMoreButton.addEventListener('click', () => {
                const captionText = modal.querySelector('.post-modal-caption-text');
                if (captionText) {
                    captionText.classList.toggle('expanded');
                    if (captionText.classList.contains('expanded')) {
                        newMoreButton.textContent = 'less';
                    } else {
                        newMoreButton.textContent = 'more';
                    }
                }
            });
        }

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
                await this.togglePostModalLike(postId, newLikeBtn, modal);
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
                    }
                    // --- End Optimistic UI Update ---

                    likeBtn.disabled = true;
                    try {
                        let response;
                        if (newLikedState) {

                            response = await fetch(`${this.baseUrl}/user/like-comment/cmnt-id=${commentId}`, {
                                method: 'POST',
                                credentials: 'include',
                                headers: { 'Content-Type': 'application/json' },

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
                        }
                    } finally {
                        likeBtn.disabled = false;
                    }
                }
            };
            commentsList.addEventListener('click', this.handleCommentLikeClickInPostModal);
        }
    }

    closePostModal(modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
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



    async togglePostModalSave(postId, saveBtn) {
        const isSaved = saveBtn.getAttribute('data-saved') === 'true';

        try {
            // Optimistic UI update
            saveBtn.setAttribute('data-saved', !isSaved);
            const svg = saveBtn.querySelector('svg');
            svg.setAttribute('fill', !isSaved ? '#0095f6' : 'none');
            svg.setAttribute('stroke', !isSaved ? '#0095f6' : '#262626');

            // Make appropriate API call
            let response;
            if (isSaved) {
                // Unsave post
                response = await fetch(`${this.baseUrl}/user/unsave-post/blog-id=${postId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
            } else {
                // Save post
                response = await fetch(`${this.baseUrl}/user/save-post/blog-id=${postId}`, {
                    method: 'POST',
                    credentials: 'include'
                });
            }

            if (!response.ok) {
                throw new Error('Failed to toggle save status');
            }

            //.log(`Post ${isSaved ? 'unsaved' : 'saved'} successfully`);

        } catch (error) {
            //.error('Error toggling save:', error);

            // Revert on error
            saveBtn.setAttribute('data-saved', isSaved);
            const svg = saveBtn.querySelector('svg');
            svg.setAttribute('fill', isSaved ? '#0095f6' : 'none');
            svg.setAttribute('stroke', isSaved ? '#0095f6' : '#262626');
        }
    }

    async toggleFeedFollow(author, followBtn) {
        const isFollowing = followBtn.getAttribute('data-following') === 'true';
        const isLocked = followBtn.getAttribute('data-is-locked') === 'true';
        const isRequestSent = this.loggedInUser.sentRequests.includes(author);

        followBtn.disabled = true;

        try {
            let response;
            if (isFollowing) {
                // --- Unfollow logic ---
                followBtn.textContent = 'follow';
                const userData = await this.fetchUserData(author);
                if (!userData) throw new Error('Failed to get user data for unfollow.');
                if (!userData.stringID) throw new Error('User ID not found for unfollow action.');

                response = await fetch(`${this.baseUrl}/user/unfollow-user/user-id=${userData.stringID}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });

                if (!response.ok) throw new Error('Unfollow action failed.');

                // Update local state
                this.loggedInUser.following = this.loggedInUser.following.filter(u => u !== author);
                this.updateFollowButtons(author, { isFollowing: false, isRequestSent: false });

            } else if (isLocked && !isRequestSent) {
                // --- Send Follow Request Logic ---
                followBtn.textContent = 'Sending...';
                response = await fetch(`${this.baseUrl}/user/follow-request/username=${encodeURIComponent(author)}`, {
                    method: 'POST',
                    credentials: 'include'
                });

                if (!response.ok) throw new Error('Send follow request failed.');

                // Update local state
                this.loggedInUser.sentRequests.push(author);
                this.updateFollowButtons(author, { isFollowing: false, isRequestSent: true });

            } else if (!isLocked) {
                // --- Direct Follow Logic ---
                followBtn.textContent = 'Following';
                const userData = await this.fetchUserData(author);
                if (!userData) throw new Error('Failed to get user data for follow.');
                if (!userData.stringID) throw new Error('User ID not found for follow action.');

                response = await fetch(`${this.baseUrl}/user/follow-user/user-id=${userData.stringID}`, {
                    method: 'POST',
                    credentials: 'include'
                });

                if (!response.ok) throw new Error('Follow action failed.');

                // Update local state
                this.loggedInUser.following.push(author);
                this.updateFollowButtons(author, { isFollowing: true, isRequestSent: false });
            }
        } catch (error) {
            //.error('Error in toggleFeedFollow:', error);
            // Revert UI on error by re-checking the state
            const finalIsFollowing = this.loggedInUser.following.includes(author);
            const finalIsRequestSent = this.loggedInUser.sentRequests.includes(author);
            this.updateFollowButtons(author, { isFollowing: finalIsFollowing, isRequestSent: finalIsRequestSent });
        }
    }

    updateFollowButtons(username, { isFollowing, isRequestSent }) {
        const buttons = document.querySelectorAll(`.post-follow-btn[data-author="${username}"]`);
        buttons.forEach(btn => {
            btn.setAttribute('data-following', isFollowing);
            if (isFollowing) {
                btn.textContent = 'Following';
                btn.className = 'post-follow-btn following';
                btn.disabled = false;
            } else if (isRequestSent) {
                btn.textContent = 'Requested';
                btn.className = 'post-follow-btn requested';
                btn.disabled = true;
            } else {
                btn.textContent = 'Follow';
                btn.className = 'post-follow-btn';
                btn.disabled = false;
            }
        });
    }

    async togglePostModalFollow(username, followBtn) {
        followBtn.disabled = true; // Disable button immediately

        try {
            // Refresh loggedInUser to get the most current follow/request status
            await this.loadUserProfile();

            const isFollowing = this.loggedInUser.following.includes(username);
            const isRequestSent = this.loggedInUser.sentRequests.includes(username);
            const postAuthorData = await this.fetchUserData(username);
            const isLocked = postAuthorData?.isLocked || false;

            let response;
            if (isFollowing) {
                // --- Unfollow logic ---
                followBtn.textContent = 'Follow';
                const userData = await this.fetchUserData(username);
                if (!userData) throw new Error('Failed to get user data for unfollow.');
                if (!userData.stringID) throw new Error('User ID not found for unfollow action.');

                response = await fetch(`${this.baseUrl}/user/unfollow-user/user-id=${userData.stringID}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });

                if (!response.ok) throw new Error('Unfollow action failed.');

                // Update local state
                this.loggedInUser.following = this.loggedInUser.following.filter(u => u !== username);
                this.updateFollowButtons(username, { isFollowing: false, isRequestSent: false });

            } else if (isLocked && !isRequestSent) {
                // --- Send Follow Request Logic ---
                followBtn.textContent = 'Sending...';
                response = await fetch(`${this.baseUrl}/user/follow-request/username=${encodeURIComponent(username)}`, {
                    method: 'POST',
                    credentials: 'include'
                });

                if (!response.ok) throw new Error('Send follow request failed.');

                // Update local state
                this.loggedInUser.sentRequests.push(username);
                this.updateFollowButtons(username, { isFollowing: false, isRequestSent: true });

            } else if (!isLocked) {
                // --- Direct Follow Logic ---
                followBtn.textContent = 'Following';
                const userData = await this.fetchUserData(username);
                if (!userData) throw new Error('Failed to get user data for follow.');
                if (!userData.stringID) throw new Error('User ID not found for follow action.');

                response = await fetch(`${this.baseUrl}/user/follow-user/user-id=${userData.stringID}`, {
                    method: 'POST',
                    credentials: 'include'
                });

                if (!response.ok) throw new Error('Follow action failed.');

                // Update local state
                this.loggedInUser.following.push(username);
                this.updateFollowButtons(username, { isFollowing: true, isRequestSent: false });
            }
        } catch (error) {
            //.error('Error in togglePostModalFollow:', error);
            // Revert UI on error by re-checking the state
            const finalIsFollowing = this.loggedInUser.following.includes(username);
            const finalIsRequestSent = this.loggedInUser.sentRequests.includes(username);
            this.updateFollowButtons(username, { isFollowing: finalIsFollowing, isRequestSent: finalIsRequestSent });
        } finally {
            followBtn.disabled = false;
        }
    }

    async submitPostModalComment(postId, commentInput, modal) {
        const commentText = commentInput.value.trim();
        if (!commentText) return;

        const commentPostBtn = modal.querySelector('.post-modal-comment-post');
        const commentList = modal.querySelector('.post-modal-comments-list');

        try {
            commentInput.disabled = true;
            if (commentPostBtn) {
                commentPostBtn.disabled = true;
                commentPostBtn.textContent = 'Posting...';
            }
            const now = new Date();
            const localTime = now.toISOString();
            const response = await fetch(`${this.baseUrl}/user/add-comment/${postId}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: commentText, standardTime: localTime })
            });

            if (response.ok) {
                const newComment = await response.json();
                const commentElement = await this.createCommentTree(newComment, 0, postId);
                if (commentElement) {
                    const noCommentsEl = commentList.querySelector('.no-comments');
                    if (noCommentsEl) {
                        noCommentsEl.remove();
                    }
                    commentList.prepend(commentElement);
                    commentInput.value = '';
                }
            } else {
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

    async loadPostComments(postId, container) {
        try {
            const comments = await this.fetchBlogComments(postId);
            container.innerHTML = '';

            if (comments.length === 0) {
                container.innerHTML = '<div style="text-align: center; color: #8e8e8e; padding: 20px;">No comments yet</div>';
                return;
            }

            for (const comment of comments) {
                if (comment && comment.comment && comment.author) {
                    const commentElement = document.createElement('div');
                    commentElement.className = 'post-modal-comment';
                    commentElement.innerHTML = `
                        <div class="comment-main-row">
                            <span class="comment-username">${comment.author}</span>
                            <span class="comment-time">${comment.time = await this.getTimeAgo(comment.standardTime) || 'unknown time'}</span>
                        </div>
                        <div class="comment-text-row">${comment.comment}</div>
                    `;
                    container.prepend(commentElement);
                }
            }
        } catch (error) {
            //.error('Error loading post comments:', error);
            container.innerHTML = '<div style="text-align: center; color: #ff3040; padding: 20px;">Failed to load comments</div>';
        }
    }

    async toggleSavePost(postId, saveBtn) {
        try {
            const isSaved = saveBtn.getAttribute('data-saved') === 'true';
            //.log('Toggle save - current state:', isSaved, 'for post:', postId);

            // Optimistically update UI
            const svg = saveBtn.querySelector('svg');
            saveBtn.setAttribute('data-saved', !isSaved);
            svg.setAttribute('fill', !isSaved ? '#0095f6' : 'none');
            svg.setAttribute('stroke', !isSaved ? '#0095f6' : '#262626');

            // Make appropriate API call
            let response;
            if (isSaved) {
                // Unsave post
                response = await fetch(`${this.baseUrl}/user/unsave-post/blog-id=${postId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
            } else {
                // Save post
                response = await fetch(`${this.baseUrl}/user/save-post/blog-id=${postId}`, {
                    method: 'POST',
                    credentials: 'include'
                });
            }

            if (!response.ok) {
                throw new Error('Failed to toggle save status');
            }

            //.log(`Post ${isSaved ? 'unsaved' : 'saved'} successfully`);

        } catch (error) {
            //.error('Error toggling save status:', error);

            // Revert UI on error
            const svg = saveBtn.querySelector('svg');
            saveBtn.setAttribute('data-saved', isSaved);
            svg.setAttribute('fill', isSaved ? '#0095f6' : 'none');
            svg.setAttribute('stroke', isSaved ? '#0095f6' : '#262626');
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

            // Render each comment
            for (const comment of filteredComments) {
                await this.renderComment(comment, commentsContainer, 0, postId);
            }

            // Update the current user's avatar in the input
            const commentInputAvatar = modal.querySelector('.comment-input-avatar');
            if (commentInputAvatar && this.userProfile?.avatar) {
                commentInputAvatar.src = this.userProfile.avatar;
            } else if (commentInputAvatar) {
                commentInputAvatar.src = this.loggedInUserAvatar;
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
        const isLiked = this.checkUserLiked(comment);

        const likeCount = comment.likes || 0;
        const canDelete =
            (comment.author === this.currentUser) ||
            (this.posts?.find(p => p.stringID === postId)?.author === this.currentUser);

        const avatarUrl = await this.getUserAvatar(comment.author);

        // Format time
        let timeAgo = '';
        
        timeAgo = await this.getTimeAgo( comment.standardTime) || 'Unknown time';
        console.log('comment', comment, 'timeAgo', timeAgo);

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
        <!-- Ensure data-liked is set correctly here -->
        <button class="comment-like-btn" data-liked="${isLiked}" data-comment-id="${comment.stringID}">${heartIcon}</button>
        <span class="comment-like-count" style="display:inline">${likeCount}</span>
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
                            <span class="comment-text">${comment.comment}</span>
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

    // Wrapper to maintain compatibility with older code paths
    async renderComment(comment, container, depth = 0, postId) {
        const el = await this.createCommentTree(comment, depth, postId);
        if (el && container) {
            container.prepend(el);
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
                this.toggleReplyInput(commentDiv, commentId);
            };
        }

        // Delete functionality
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (await this.showConfirmation('Delete this comment?')) {
                    try {
                        const response = await fetch(`${this.baseUrl}/user/delete-comment/cmnt-id=${commentId}`, {
                            method: 'DELETE',
                            credentials: 'include'
                        });
                        
                        if (!response.ok) {
                            throw new Error('Failed to delete comment');
                        }

                        commentDiv.remove();

                    } catch (e) {
                        //.error('Error deleting comment:', e);
                        this.showError('Could not delete comment. Please try again.');
                    }
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

    toggleReplyInput(commentDiv, commentId) {
        const replyContainer = commentDiv.querySelector('.reply-input-container');

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
                        await this.submitReply(commentId, text);
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
                    await this.submitReply(commentId, text);
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
    async submitReply(parentCommentId, text) {
        try {
            const now = new Date();
            const localTime = now.toISOString();
            const response = await fetch(`${this.baseUrl}/user/reply-comment/cmnt-id=${parentCommentId}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: text, standardTime: localTime })
            });

            if (!response.ok) throw new Error('Failed to add reply');

            // Optimistically add the new reply to the correct replies container
            const newReply = await response.json();
            const parentCommentDiv = document.querySelector(`.comment-tree-item[data-comment-id="${parentCommentId}"]`);
            if (parentCommentDiv && newReply && newReply.stringID) {
                const repliesContainer = parentCommentDiv.querySelector('.replies-container');
                if (repliesContainer) {
                    const depth = (parseInt(parentCommentDiv.getAttribute('data-depth')) || 0) + 1;
                    const replyElement = await this.createCommentTree(newReply, depth, this.currentPostId);
                    if (replyElement) {
                        repliesContainer.prepend(replyElement);
                    }
                }
            }
        } catch (error) {
            //.error('Error adding reply:', error);
            this.showError('Failed to add reply. Please try again.');
            // Only refresh modal on error
            await this.renderCommentsModal(this.currentPostId);
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



    setupEditProfileModal() {
        //.log('Setting up edit profile modal...');
        const modal = document.getElementById('edit-profile-modal');
        const saveBtn = modal?.querySelector('#save-profile-btn');
        const profileForm = modal?.querySelector('.edit-form'); // Changed selector to .edit-form

        if (!modal || !saveBtn || !profileForm) {
            //.warn('Edit profile modal elements not found');
            return;
        }

        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // For a div, FormData won't work directly. We need to manually get values.
            const bioInput = profileForm.querySelector('#editBio');
            const bio = bioInput ? bioInput.value : '';
            // Assuming there's no actual form submission, just an event listener on the div.
            // If there were other inputs, they would need to be retrieved similarly.

            try {
                const response = await fetch(`${this.baseUrl}/user/edit-bio`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(bio || '')
                });

                if (!response.ok) throw new Error('Failed to update profile');

                await this.loadUserProfile();
                modal.style.display = 'none';

            } catch (error) {
                //.error('Error updating profile:', error);

            }
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    setupPostOptionsModal() {
        //.log('Setting up post options modal...');
        const modal = document.getElementById('post-options-modal');
        const closeBtn = modal?.querySelector('.close-options-modal');
        const deleteOption = modal?.querySelector('#delete-post-option');

        if (!modal || !closeBtn || !deleteOption) {
            //.warn('Post options modal elements not found');
            return;
        }

        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            this.currentPostId = null;
        });

        deleteOption.addEventListener('click', async () => {
            if (this.currentPostId && await this.showConfirmation('Do you want to delete this post?')) {
                await this.deletePost(this.currentPostId);
                modal.style.display = 'none';
            }
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                this.currentPostId = null;
            }
        });
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
            modal.classList.remove('active');
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
                modal.classList.remove('active');
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
                modal.classList.remove('active');
            });
            optionsContainer.appendChild(reportUserBtn);
        }

        modal.classList.add('active');
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
                this.showError('Please select a reason or provide a description for the report.');
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

            this.showSuccess('Report submitted successfully!');
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

            if (!response.ok) throw new Error('Failed to delete post');
            await this.loadFeed();
        } catch (error) {
            //.error('Error deleting post:', error);

        }
    }

    // Add method to switch tabs
    switchTab(tab) {
        //.log('Switching to tab:', tab);
        const homeBtn = document.querySelector('.nav-btn[data-tab="home"]');
        const profileBtn = document.querySelector('.nav-btn[data-tab="profile"]');
        const createPostBtn = document.getElementById('create-post-btn');

        if (!homeBtn || !profileBtn || !createPostBtn) {
            //.warn('Navigation buttons not found');
            return;
        }

        homeBtn.classList.remove('active');
        profileBtn.classList.remove('active');
        createPostBtn.classList.remove('active');

        if (tab === 'home') {
            homeBtn.classList.add('active');
            this.currentTab = 'home';
            this.loadFeed();
        } else if (tab === 'profile') {
            profileBtn.classList.add('active');
            this.currentTab = 'profile';
            this.updateProfileDisplay();
        }
    }

    setupEventListeners() {
        // Navigation tab switching
        const homeBtn = document.getElementById('home-btn');
        const postBtn = document.getElementById('create-post-btn');
        const profileBtn = document.getElementById('profile-btn');
        const followRequestsMainBtn = document.getElementById('follow-requests-main-btn'); // Get the new button
        const openPostStoryModalBtn = document.getElementById('open-post-story-modal-btn');

        if (openPostStoryModalBtn) {
            openPostStoryModalBtn.addEventListener('click', () => {
                this.openCreatePostModalForStory();
            });
        }

        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                this.switchTab('home');
            });
        }
        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                this.openProfile();
            });
        }
        if (postBtn) {
            postBtn.addEventListener('click', () => {
                const modal = document.getElementById('create-post-modal');
                if (modal) {
                    modal.classList.add('active');
                    document.body.style.overflow = 'hidden';
                }
            });
        }
        // Add event listener for the new follow requests button
        if (followRequestsMainBtn) {
            followRequestsMainBtn.addEventListener('click', () => {
                this.openFollowRequestsModal();
            });
        }

        setInterval(() => {
            this.loadFeed();
        }, 3000);
    }

    // Setup post click listeners using event delegation
    setupPostClickListeners() {
        // Use event delegation on feed container for all post clicks
        const feedContainer = document.getElementById('feed-container');
        if (!feedContainer) return;

        // Remove any existing listeners to prevent duplicates
        feedContainer.removeEventListener('click', this.handlePostClick);

        // Add single delegated listener
        this.handlePostClick = (e) => {
            // Check if click is on a post image or carousel slide
            const postImage = e.target.closest('.carousel-slide img, .post-images-container img');
            const postMenuBtn = e.target.closest('.post-menu-btn');

            if (postImage) {
                const postCard = e.target.closest('.insta-post-card');
                if (postCard) {
                    const postId = postCard.getAttribute('data-post-id');
                    if (postId) {
                        e.preventDefault();
                        e.stopPropagation();
                        const post = this.posts.find(p => p.stringID === postId);
                        if (post) {
                            this.showPostModal(post);
                        } else {
                            //.error('Post not found for ID:', postId);
                        }
                    }
                }
            } else if (postMenuBtn) {
                e.preventDefault();
                e.stopPropagation();
                const postCard = e.target.closest('.insta-post-card');
                if (postCard) {
                    const postId = postCard.getAttribute('data-post-id');
                    const post = this.posts.find(p => p.stringID === postId);
                    if (post) {
                        this.openReportOptionsModal(post.author, postId, e); // Pass author and post ID
                    }
                }
            }
        };

        feedContainer.addEventListener('click', this.handlePostClick);
    }

    // Open profile page
    openProfile(username = null) {
        const targetUsername = username || this.currentUser;
        const profileUrl = `profile.html?username=${encodeURIComponent(targetUsername)}`;
        window.location.href = profileUrl;
    }

    // Make usernames clickable throughout the app
    makeUsernameClickable(usernameElement, username) {
        if (usernameElement && username) {
            usernameElement.style.cursor = 'pointer';
            usernameElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openProfile(username);
            });
        }
    }

    // Get user avatar
    async getUserAvatar(username) {
        try {
            if (username === this.currentUser) {
                return this.loggedInUserAvatar;
            }

            const userResponse = await fetch(`${this.baseUrl}/user/get-user/username=${encodeURIComponent(username)}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (userResponse.ok || userResponse.status === 423) {
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
            return this.genericAvatar;
        } catch (e) {
            //.warn('Failed to load avatar for user:', username, e);
            return this.genericAvatar;
        }
    }

    // Fetch likes for a blog
    async fetchBlogLikes(blogId) {
        try {
            const res = await fetch(`${this.baseUrl}/user/blog-likes/${blogId}`, { credentials: 'include' });
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            return [];
        }
    }

    // Fetch comments for a blog
    async fetchBlogComments(blogId) {
        try {
            const res = await fetch(`${this.baseUrl}/user/get-all-comments/blog-id=${blogId}`, { credentials: 'include' });

            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            return [];
        }
    }

    // New helper to get a file's blob URL by its ID
    async getFileBlobUrl(fileId) {
        if (!fileId) return null;
        try {
            const fileRes = await fetch(`${this.baseUrl}/files/get-files/file-id=${fileId}`, {
                credentials: 'include'
            });
            if (!fileRes.ok) {

                return null;
            }
            const blob = await fileRes.blob();
            return URL.createObjectURL(blob);
        } catch (e) {

            return null;
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

    hasUserLiked(post) {
        return post.likedBy && post.likedBy.includes(this.currentUser);
    }

    // Add this method to check if the current user has liked the post
    checkBlogLiked(blog, user) {
        if (blog && user)
            return blog.likedBy && blog.likedBy.includes(user.username);
        return false;
    }

    checkBlogSaved(blogId, user) {
        if (blogId && user) {
            return user.savedPost.includes(blogId);
        }
        return false;
    }

    checkUserFollowing(username, user) {
        if (username && user) {
            return user.following.includes(username);
        }
        return false;
    }

    async getCurrentUserLikeId(blogId) {
        const res = await fetch(`${this.baseUrl}/user/get-likeID/blog-id=${blogId}`, { credentials: 'include' });
        if (!res.ok) {
            //.log(`getCurrentUserLikeId: Response not OK (${res.status}) for blogId: ${blogId}`);
            return null;
        }

        const text = await res.text();
        if (!text) {
            // This is a valid case if the user hasn't liked the post.
            //.log('getCurrentUserLikeId received an empty response, meaning user has not liked this post.');
            return null;
        }

        try {
            const data = JSON.parse(text);
            //.log('getCurrentUserLikeId response:', data);
            // Use stringID if present
            if (typeof data.stringID === 'string' && data.stringID) return data.stringID;
            if (typeof data.likeId === 'string' && data.likeId) return data.likeId;
            if (data.likeId && typeof data.likeId === 'object' && data.likeId.$oid) return data.likeId.$oid;
            if (typeof data.id === 'string' && data.id) return data.id;
            if (data.id && typeof data.id === 'object' && data.id.$oid) return data.id.$oid;

            //.warn('getCurrentUserLikeId: Found data object but no valid ID field.', data);
            return null;
        } catch (e) {
            //.error("Failed to parse JSON from text:", text, e);
            return null;
        }
    }

    // Add as a class method:
    // Helper function to check if the current user has liked an item (post or comment)
    checkUserLiked(item) {
        if (!item || !item.likedBy || !Array.isArray(item.likedBy)) {
            return false;
        }
        return item.likedBy.includes(this.currentUser);
    }



    // Checks if the current user has liked a specific blog post


    async togglePostModalLike(postId, likeBtnElement, modal) {
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
                const now = new Date();
                const localTime = now.toISOString();
                response = await fetch(`${this.baseUrl}/user/add-likes/${postId}`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ standardTime: localTime })
                });
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
            const post = this.posts.find(p => p.stringID === postId);
            if (post) {
                if (newLikedState) {
                    if (!post.likedBy.includes(this.currentUser)) {
                        post.likedBy.push(this.currentUser);
                    }
                } else {
                    const index = post.likedBy.indexOf(this.currentUser);
                    if (index > -1) {
                        post.likedBy.splice(index, 1);
                    }
                }
            }

            // Update the corresponding post in the feed to keep it in sync
            const feedElement = document.querySelector(`.insta-post-card[data-post-id="${postId}"]`);
            if (feedElement) {
                const feedLikeBtn = feedElement.querySelector('.like-btn');
                const feedLikeCount = feedElement.querySelector('.like-count');
                const feedSvg = feedLikeBtn.querySelector('svg');

                feedLikeBtn.setAttribute('data-liked', String(newLikedState));
                feedSvg.setAttribute('fill', newLikedState ? '#ff3040' : 'none');
                feedSvg.setAttribute('stroke', newLikedState ? '#ff3040' : '#262626');
                if (feedLikeCount && likesElement) {
                    feedLikeCount.textContent = likesElement.textContent;
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

    // Utility functions for modals and messages
    openCreatePostModalForStory() {
        this.isPostingStory = true;
        const modal = document.getElementById('create-post-modal');
        const modalTitle = modal.querySelector('.modal-header h2');
        const captionContainer = document.querySelector('.caption-container');
        if (modal) {
            if (modalTitle) modalTitle.textContent = 'Create New Story';
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            if (captionContainer) {
                captionContainer.style.display = 'none';
            }
        }
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    showMessage(message, type = 'success') {
        const messageModal = document.getElementById('message-modal');
        const messageText = document.getElementById('message-text');
        if (messageModal && messageText) {
            messageText.textContent = message;
            messageModal.className = `message-modal ${type} active`;
            document.body.style.overflow = 'hidden';
            setTimeout(() => {
                messageModal.classList.remove('active');
                document.body.style.overflow = '';
            }, 3000);
        }
    }

    async checkCorsConfig() {
        try {
            const response = await fetch(`${this.baseUrl}/cors-check`, {
                method: 'OPTIONS',
                mode: 'cors'
            });
            if (response.ok) {
                //.log('CORS check successful.');
                return true;
            } else {
                //.error('CORS check failed:', response.status, response.statusText);
                return false;
            }
        } catch (error) {
            //.error('CORS check failed due to network error or misconfiguration:', error);
            return false;
        }
    }

    setupFollowRequestsModal() {
        const modal = document.getElementById('followRequestsModal');
        const closeBtn = document.getElementById('close-follow-requests-modal'); // Use the specific ID
        const backdrop = modal;

        if (!modal) {
            //.warn('Follow requests modal not found.');
            return;
        }

        // Close button event listener
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal('followRequestsModal');
            });
        }

        // Backdrop click to close
        if (backdrop) {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    this.closeModal('followRequestsModal');
                }
            });
        }

        // Prevent clicks inside modal content from closing modal
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.onclick = (e) => {
                e.stopPropagation();
            };
        }

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                this.closeModal('followRequestsModal');
            }
        });
    }


    async openFollowRequestsModal() {
        this.openModal('followRequestsModal');
        await this.loadFollowRequests();
    }

    async loadFollowRequests() {
        const requestsContainer = document.getElementById('follow-requests-list');
        if (!requestsContainer) {
            //.error('Follow requests list container not found.');
            return;
        }

        requestsContainer.innerHTML = '<div class="loading-indicator">Loading requests...</div>';

        try {
            // Ensure loggedInUser is up-to-date
            const response = await fetch(`${this.baseUrl}/user`, { credentials: 'include' });

            // Add redirect logic for 401/403
            if (response.status === 401 || response.status === 403) {
                //.warn('Unauthorized in loadFollowRequests, redirecting to login...');
                window.location.href = 'login.html';
                return; // Stop execution here
            }

            if (!response.ok) {
                throw new Error('Failed to fetch current user data.');
            }
            this.loggedInUser = await response.json();

            const receivedRequests = this.loggedInUser.receivedRequests || [];
            //.log('Received follow requests:', receivedRequests);

            requestsContainer.innerHTML = ''; // Clear loading indicator

            if (receivedRequests.length === 0) {
                requestsContainer.innerHTML = `
                    <div class="no-requests-backdrop">
                        
                        <p>Follow requests will appear here</p>
                    </div>
                `;
                return;
            }

            for (const requestUsername of receivedRequests) {
                await this.renderFollowRequest(requestUsername, requestsContainer);
            }

        } catch (error) {
            //.error('Error loading follow requests:', error);
            requestsContainer.innerHTML = '<div class="error-message">Failed to load follow requests.</div>';
        }
    }

    async renderFollowRequest(username, container) {
        try {
            const avatarUrl = await this.getUserAvatar(username);

            const requestElement = document.createElement('div');
            requestElement.className = 'follow-request-item';
            requestElement.innerHTML = `
                <img src="${avatarUrl}" alt="${username}" class="follow-request-avatar">
                <span class="follow-request-username">${username}</span>
                <div class="follow-request-actions">
                    <button class="accept-request-btn" data-username="${username}">Accept</button>
                    <button class="reject-request-btn" data-username="${username}">Reject</button>
                </div>
            `;
            container.appendChild(requestElement);

            // Make username clickable
            const usernameSpan = requestElement.querySelector('.follow-request-username');
            this.makeUsernameClickable(usernameSpan, username);

            // Add event listeners for accept/reject buttons
            requestElement.querySelector('.accept-request-btn').addEventListener('click', async (e) => {
                const targetUsername = e.target.dataset.username;
                await this.acceptFollowRequest(targetUsername, requestElement);
            });

            requestElement.querySelector('.reject-request-btn').addEventListener('click', async (e) => {
                const targetUsername = e.target.dataset.username;
                await this.rejectFollowRequest(targetUsername, requestElement);
            });

        } catch (error) {
            //.error('Error rendering follow request for', username, ':', error);
        }
    }

    async acceptFollowRequest(username, requestElement) {
        try {
            const userResponse = await fetch(`${this.baseUrl}/user/get-user/username=${encodeURIComponent(username)}`, {
                method: 'GET',
                credentials: 'include'
            });
            if (!userResponse.ok) throw new Error('Failed to get user ID for acceptance');
            const userData = await userResponse.json();
            const userId = userData.stringID;

            const response = await fetch(`${this.baseUrl}/user/accept-request/username=${encodeURIComponent(username)}`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to accept follow request');
            }

            this.showMessage(`Accepted follow request from ${username}`, 'success');
            requestElement.remove(); // Remove from UI
            await this.loadFollowRequests(); // Refresh the list
            this.updateFollowRequestsDot(); // Update dot after accepting
        } catch (error) {
            //.error('Error accepting follow request:', error);
            this.showMessage(`Failed to accept request from ${username}.`, 'error');
        }
    }

    async rejectFollowRequest(username, requestElement) {
        try {
            const userResponse = await fetch(`${this.baseUrl}/user/get-user/username=${encodeURIComponent(username)}`, {
                method: 'GET',
                credentials: 'include'
            });
            if (!userResponse.ok) throw new Error('Failed to get user ID for rejection');
            const userData = await userResponse.json();
            const userId = userData.stringID;

            const response = await fetch(`${this.baseUrl}/user/reject-request/username=${encodeURIComponent(username)}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to reject follow request');
            }

            this.showMessage(`Rejected follow request from ${username}`, 'info');
            requestElement.remove(); // Remove from UI
            await this.loadFollowRequests(); // Refresh the list
            this.updateFollowRequestsDot(); // Update dot after rejecting
        } catch (error) {
            //.error('Error rejecting follow request:', error);
            this.showMessage(`Failed to reject request from ${username}.`, 'error');
        }
    }

    // New method to update the visibility of the follow requests notification dot
    async updateFollowRequestsDot() {
        const followRequestsBtn = document.getElementById('follow-requests-main-btn');
        const icon = followRequestsBtn?.querySelector('i');

        if (!followRequestsBtn || !icon) {
            //.warn('Follow requests main button or icon not found.');
            return;
        }

        try {
            // Fetch current user with cookies (JWT stored in cookie)
            const response = await fetch(`${this.baseUrl}/user`, { credentials: 'include' });

            if (!response.ok) {
                throw new Error('Failed to fetch user data.');
            }

            this.loggedInUser = await response.json();

            const receivedRequests = this.loggedInUser.receivedRequests || [];

            if (receivedRequests.length > 0) {
                icon.style.color = '#df1a1aff'; // red-ish if new requests
            } else {
                icon.style.color = '#0095f6'; // blue if no requests
            }

        } catch (error) {
            //.error('Error updating follow request icon:', error);

            // fallback icon color
            icon.style.color = '#0095f6';
        }
    }


    // New methods for stories
    async postStoryWithCroppedFile(file) {
        try {
            this.closeModal('cropper-modal');
            this.closeModal('create-post-modal');
            // Step 1: Upload the file and get the file ID
            const formData = new FormData();
            formData.append('file', file);

            const uploadResponse = await fetch(`${this.baseUrl}/files/upload-files`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (!uploadResponse.ok) {
                throw new Error(`File upload failed: ${uploadResponse.status}`);
            }

            const fileIdResponse = await uploadResponse.json();
            //.log('File ID response:', fileIdResponse);

            // Step 2: Create the story with the file ID
                const now = new Date();
                const localTime = now.toISOString();
                const story = {
                    fileID: fileIdResponse.stringID,
                    standardTime: localTime
                };

            const postStoryResponse = await fetch(`${this.baseUrl}/user/post-story`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(story),
                credentials: 'include'
            });
            //.log('Post story response:', postStoryResponse);
            const storyResponseData = await postStoryResponse.json();
            //.log('Post story response data:', storyResponseData);

            if (!postStoryResponse.ok) {
                throw new Error(`Failed to post story: ${postStoryResponse.status}`);
            }

            this.showSuccess('Story posted successfully!');
            // Optionally, refresh the stories view
            if (this.fetchAllStories) {
                await this.fetchAllStories();
            }

        } catch (error) {
            //.error('Error posting story:', error);
            this.showError('Failed to post story. Please try again.');
        } finally {
            this.isCroppingForStory = false; // Reset the flag
            this.croppedFiles = []; // Clear cropped files
            this.filesToCrop = []; // Clear files to crop
        }
    }

    async fetchAllStories() {
        try {
            const response = await fetch(`${this.baseUrl}/user/get-my-story`, {
                method: 'GET',
                credentials: 'include'
            });

            const allStoriesResponse = await fetch(`${this.baseUrl}/user/all-stories`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!allStoriesResponse.ok) {
                throw new Error(`HTTP error! status: ${allStoriesResponse.status}`);
            }
            let fetchedStories = await allStoriesResponse.json();
            //.log('Fetched stories:', fetchedStories);

            let myStories = [];
            if (response.ok) {
                myStories = await response.json();
                //.log('My stories:', myStories);
            }

            const myStoriesMap = new Map(myStories.map(story => [story.stringID || story.id, story]));

            let flattenedStories = [];
            if (Array.isArray(fetchedStories)) {
                fetchedStories.forEach(storyGroup => {
                    if (Array.isArray(storyGroup)) {
                        storyGroup.forEach(story => {
                            const storyId = story.stringID || story.id;
                            if (myStoriesMap.has(storyId)) {
                                flattenedStories.push(myStoriesMap.get(storyId));
                                myStoriesMap.delete(storyId);
                            } else {
                                flattenedStories.push(story);
                            }
                        });
                    }
                });
            }

            // Add any remaining stories from myStoriesMap (stories that were not in 'all-stories')
            flattenedStories.push(...myStoriesMap.values());

            //.log('All stories after merge:', flattenedStories);

            const storiesByUser = new Map();
            if (this.loggedInUser && this.loggedInUser.username) {
                flattenedStories.forEach(story => {
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

            const sortedStories = Array.from(storiesByUser.values());

            // Sort stories: current user first, then unviewed, then viewed, then by time
            sortedStories.sort((a, b) => {
                const aIsCurrentUser = a.author === this.loggedInUser.username;
                const bIsCurrentUser = b.author === this.loggedInUser.username;

                if (aIsCurrentUser && !bIsCurrentUser) return -1;
                if (!aIsCurrentUser && bIsCurrentUser) return 1;

                if (!a.viewed && b.viewed) return -1;
                if (a.viewed && !b.viewed) return 1;

                const aLatestTime = Math.max(...a.stories.map(s => new Date(s.standardTime).getTime()));
                const bLatestTime = Math.max(...b.stories.map(s => new Date(s.standardTime).getTime()));
                return bLatestTime - aLatestTime;
            });

            this.stories = sortedStories;
            this.renderStories(); // Re-render stories after fetching
        } catch (error) {
            //.error('Error fetching stories:', error);
            this.stories = []; // Clear stories on error
            this.renderStories(); // Render empty state
        }
    }

    async renderStories() {
        const storiesContainer = document.getElementById('stories-container');
        if (!storiesContainer) {
            //.warn('Stories container not found.');
            return;
        }

        storiesContainer.innerHTML = ''; // Clear existing stories

        // Always add "Your Story" circle first, which handles both adding and viewing own stories
        if (this.loggedInUser) {
            const currentUserStoryGroup = this.stories.find(sg => sg.author === this.loggedInUser.username);
            const yourStoryElement = await this.createAddStoryCircle(this.loggedInUser, currentUserStoryGroup);
            storiesContainer.appendChild(yourStoryElement);
        }

        // Add all other users' story groups
        for (const storyGroup of this.stories) {
            if (this.loggedInUser && storyGroup.author === this.loggedInUser.username) {
                continue; // Already handled by createAddStoryCircle
            }
            const storyElement = await this.createStoryCircle(storyGroup);
            storiesContainer.appendChild(storyElement);
        }
    }

    async createAddStoryCircle(loggedInUser, storyGroup = null) {
        const storyCircle = document.createElement('div');
        storyCircle.classList.add('story-circle', 'add-story-circle');

        const avatarUrl = await this.getUserAvatar(loggedInUser.username);

        let wrapperClass = 'story-circle-wrapper add-story';
        if (!storyGroup || storyGroup.viewed) {
            wrapperClass += ' viewed';
        }

        storyCircle.innerHTML = `
            <div class="${wrapperClass}">
                <div class="story-avatar">
                    <img src="${avatarUrl}" alt="Your Story">
                </div>
                <div class="add-story-icon">+</div>
            </div>
            <span class="story-username">Your Story</span>
        `;

        const hasStories = storyGroup && storyGroup.stories.length > 0;

        storyCircle.addEventListener('click', () => {
            if (hasStories) {
                this.openStoryModal(loggedInUser.username);
            } else {
                this.openCreatePostModalForStory();
            }
        });

        const addIcon = storyCircle.querySelector('.add-story-icon');
        addIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openCreatePostModalForStory();
        });

        return storyCircle;
    }

    async createStoryCircle(storyGroup) {
        const storyCircle = document.createElement('div');
        storyCircle.classList.add('story-circle');
        storyCircle.setAttribute('data-author', storyGroup.author);

        const avatarUrl = await this.getUserAvatar(storyGroup.author);

        let wrapperClass = 'story-circle-wrapper';
        if (storyGroup.viewed) {
            wrapperClass += ' viewed';
        }

        storyCircle.innerHTML = `
            <div class="${wrapperClass}">
                <div class="story-avatar">
                    <img src="${avatarUrl}" alt="${storyGroup.author}">
                </div>
            </div>
            <span class="story-username">${storyGroup.author}</span>
        `;

        storyCircle.addEventListener('click', () => {
            this.openStoryModal(storyGroup.author);
        });

        return storyCircle;
    }

    // ------------------ STORY MODAL LOGIC ------------------

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

    async updateViewStoryButton(story) {
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
                const timeAgo = this.getTimeAgo(activeStory.standardTime);
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
            const timeAgo = await this.getTimeAgo(activeStory.standardTime); // Await the async function
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
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },

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
                    // Update the story circles on the feed to reflect the viewed status
                    this.renderStories();
                } catch (error) {
                    //.error('Error toggling story like:', error);
                    this.updateStoryLikeButtonUI(isLiked, currentLikesCount);
                    this.showError('Failed to like/unlike story.');
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
                            throw new Error(`Failed to delete story: ${response.status}`);
                        }

                        this.showSuccess('Story deleted successfully!');

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

                        // Update the story circles on the feed to reflect the changes
                        this.renderStories();

                    } catch (error) {
                        //.error('Error deleting story:', error);
                        this.showError('Failed to delete story.');
                    }
                }
            };
        }
    }

    async setupPeopleSuggestions() {
        const modal = document.getElementById('people-suggestions-modal');
        const list = document.getElementById('people-suggestions-list');

        if (!modal || !list) {
            //.warn('People suggestions modal elements not found');
            return;
        }

        try {
            const response = await fetch(`${this.baseUrl}/user/get-people-suggestion`, {
                credentials: 'include'
            });


            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const suggestions = await response.json();
            //.log("suggestions", suggestions);
            if (suggestions.length === 0) {
                modal.style.display = 'none';
                return;
            }

            modal.style.display = 'block';
            list.innerHTML = '';

            for (const username of suggestions) {
                const userResponse = await fetch(`${this.baseUrl}/user/get-user/username=${username}`, {
                    credentials: 'include'
                });

                if (userResponse.ok || userResponse.status === 423) {
                    const userData = await userResponse.json();
                    const avatarResponse = await fetch(`${this.baseUrl}/files/get-files/file-id=${userData.profileAvatarID}`, {
                        credentials: 'include'
                    });

                    if (avatarResponse.ok) {
                        const blob = await avatarResponse.blob();
                        const avatarUrl = URL.createObjectURL(blob);

                        const item = document.createElement('div');
                        item.className = 'suggestion-item';
                        item.innerHTML = `
                            <div class="suggestion-avatar">
                                <img src="${avatarUrl}" alt="${username}">
                            </div>
                            <span class="suggestion-username">${username}</span>
                        `;

                        item.addEventListener('click', () => {
                            window.location.href = `profile.html?username=${username}`;
                        });

                        list.appendChild(item);
                    }
                }
            }
        } catch (error) {
            //.error('Error setting up people suggestions:', error);
        }
    }

    setupCaption(postElement) {
        const caption = postElement.querySelector('.post-caption .caption-text');
        if (!caption) return;

        const usernameElement = caption.querySelector('strong');
        if (!usernameElement) return;

        // Extract only the caption text after <strong>
        let fullCaptionText = '';
        for (const node of caption.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                fullCaptionText += node.textContent;
            }
        }
        fullCaptionText = fullCaptionText.trim();

        const maxChars = 30; // limit by characters
        if (fullCaptionText.length > maxChars) {
            // Avoid cutting in the middle of a word
            let shortText = fullCaptionText.slice(0, maxChars);
            const lastSpace = shortText.lastIndexOf(' ');
            if (lastSpace > 0) shortText = shortText.slice(0, lastSpace);
            shortText += '... ';

            const usernameHTML = `<strong>${usernameElement.textContent}</strong>`;

            // Create More button
            const moreBtn = document.createElement('button');
            moreBtn.textContent = 'more';
            moreBtn.className = 'more-btn';
            moreBtn.style.cssText =
                "display: inline; border: none; background: none; color: #8e8e8e; padding: 0 0 0 5px; cursor: pointer; font-weight: bold;";

            // Initial short version
            caption.innerHTML = `${usernameHTML} ${shortText.replace(/\n/g, '<br>')}`;
            caption.appendChild(moreBtn);

            // Toggle logic
            moreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (moreBtn.textContent === 'more') {
                    caption.innerHTML = `${usernameHTML} ${fullCaptionText.replace(/\n/g, '<br>')}`;
                    moreBtn.textContent = 'less';
                } else {
                    caption.innerHTML = `${usernameHTML} ${shortText.replace(/\n/g, '<br>')}`;
                    moreBtn.textContent = 'more';
                }
                caption.appendChild(moreBtn); // re-append after overwrite
            });
        } else {
            // If short enough, just preserve newlines
            caption.innerHTML = caption.innerHTML.replace(/\n/g, '<br>');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    //.log('DOM loaded, creating instance...');
    window.app = new InstagramClone();
});

function closeErrorModal() {
    if (window.app) {
        window.app.closeErrorModal();
    }
}
