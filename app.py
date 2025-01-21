import streamlit as st
import requests
from dotenv import load_dotenv, set_key
import os
import json

# Load environment variables
load_dotenv()

# Configure environment variables with defaults
FRONTEND_URL = os.getenv('FRONTEND_URL', 'https://main-jc47.onrender.com')
BACKEND_URL = os.getenv('BACKEND_URL', 'https://backend-a8mm.onrender.com')

def save_to_env(api_key):
    """Save API key to .env file"""
    try:
        env_path = 'backend/.env'
        set_key(env_path, 'OPENAI_API_KEY', api_key)
        return True
    except Exception as e:
        st.error(f"Error saving API key: {e}")
        return False

def create_visualization_html(repo_data=None):
    """Create HTML for visualization with data injection"""
    # Get URL parameters if they exist
    params = st.experimental_get_query_params()
    owner = params.get('owner', [None])[0]
    repo = params.get('repo', [None])[0]
    
    # Build the frontend URL with parameters if they exist
    frontend_url = FRONTEND_URL
    if owner and repo:
        frontend_url = f"{FRONTEND_URL}?owner={owner}&repo={repo}"

    return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body, html {{
                    width: 100%;
                    height: 100%;
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                }}
                .visualization-container {{
                    position: fixed;
                    top: 60px;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    display: flex;
                    overflow: hidden;
                }}
                iframe {{
                    width: 100%;
                    height: 100%;
                    border: none;
                }}
            </style>
            <script>
                window.repoData = {json.dumps(repo_data) if repo_data else 'null'};
            </script>
        </head>
        <body>
            <div class="visualization-container">
                <iframe src="{frontend_url}" frameborder="0"></iframe>
            </div>
        </body>
        </html>
    """

def main():
    # Initialize session state
    if 'messages' not in st.session_state:
        st.session_state.messages = []
    if 'repo_data' not in st.session_state:
        st.session_state.repo_data = None
    if 'visualization_counter' not in st.session_state:
        st.session_state.visualization_counter = 0

    # Get URL parameters if they exist
    params = st.experimental_get_query_params()
    url_owner = params.get('owner', [None])[0]
    url_repo = params.get('repo', [None])[0]

    # Sidebar for repository input
    with st.sidebar:
        st.header("Repository Analysis")
        owner = st.text_input("Repository Owner", value=url_owner or "microsoft")
        repo = st.text_input("Repository Name", value=url_repo or "vscode")
        
        # Direct link for sharing
        current_page = st.get_page_config().get('page_url', '')
        share_url = f"{current_page}?owner={owner}&repo={repo}"
        st.markdown(f"Share link: [{owner}/{repo}]({share_url})")
        
        # Debug information (can be commented out in production)
        with st.expander("Debug Info"):
            st.write(f"Frontend URL: {FRONTEND_URL}")
            st.write(f"Backend URL: {BACKEND_URL}")
            st.write(f"API Key present: {'Yes' if os.getenv('API_KEY') else 'No'}")
        
        if st.button("Analyze Repository"):
            with st.spinner("Analyzing repository..."):
                try:
                    response = requests.post(
                        f'{BACKEND_URL}/api/v1/analyze',
                        json={'owner': owner, 'repo': repo, 'limit': 50},
                        headers={
                            'Content-Type': 'application/json',
                            'X-API-Key': os.getenv('API_KEY', '')
                        }
                    )
                    if response.ok:
                        st.session_state.repo_data = response.json()
                        st.session_state.visualization_counter += 1
                        st.success("Analysis complete!")
                        # Update URL parameters
                        st.experimental_set_query_params(owner=owner, repo=repo)
                    else:
                        st.error(f"Analysis failed: {response.status_code} - {response.text}")
                except Exception as e:
                    st.error(f"Error during analysis: {str(e)}")

        st.divider()
        
        # Create scrollable container for chat messages
        st.markdown('<div class="sidebar-chat-container">', unsafe_allow_html=True)
        for msg in st.session_state.messages:
            with st.chat_message(msg["role"]):
                st.write(msg["content"])
        st.markdown('</div>', unsafe_allow_html=True)

        # Fixed chat input at bottom
        if prompt := st.chat_input("Ask a question..."):
            st.session_state.messages.append({"role": "user", "content": prompt})
            # TODO: Implement actual chat response handling
            st.session_state.messages.append({"role": "assistant", "content": "This is a placeholder response"})
            st.rerun()

    # Main area for visualization
    if 'api_key' not in st.session_state:
        st.markdown("<br>" * 5, unsafe_allow_html=True)
        col1, col2, col3 = st.columns([1,2,1])
        with col2:
            name = st.text_input("Enter your name:")
            api_key = st.text_input("Enter API Key:", type="password")
            
            if st.button("Start", use_container_width=True):
                if name and api_key:
                    if save_to_env(api_key):
                        st.session_state.api_key = api_key
                        st.success("API key saved successfully!")
                        st.rerun()
    else:
        # If URL parameters are present and no analysis has been done yet, trigger automatic analysis
        if url_owner and url_repo and not st.session_state.repo_data:
            with st.spinner(f"Analyzing {url_owner}/{url_repo}..."):
                try:
                    response = requests.post(
                        f'{BACKEND_URL}/api/v1/analyze',
                        json={'owner': url_owner, 'repo': url_repo, 'limit': 50},
                        headers={
                            'Content-Type': 'application/json',
                            'X-API-Key': os.getenv('API_KEY', '')
                        }
                    )
                    if response.ok:
                        st.session_state.repo_data = response.json()
                        st.session_state.visualization_counter += 1
                        st.success("Analysis complete!")
                    else:
                        st.error(f"Analysis failed: {response.status_code} - {response.text}")
                except Exception as e:
                    st.error(f"Error during analysis: {str(e)}")

        # Remove padding and maximize space
        st.markdown("""
            <style>
                .block-container {
                    padding: 0;
                    max-width: 100%;
                }
                
                .main > div {
                    padding: 0;
                }
                
                #root > div:nth-child(1) > div.withScreencast > div > div > div > section.main {
                    padding: 0;
                }
                
                section.main {
                    pointer-events: none;
                }
                
                .stButton {
                    pointer-events: auto;
                }
                
                [data-testid="stAppViewContainer"] {
                    background-color: rgb(17, 19, 23);
                }
                
                iframe {
                    height: calc(100vh - 60px) !important;
                    background-color: rgb(17, 19, 23);
                }
            </style>
        """, unsafe_allow_html=True)
        
        html_content = f"""
            <div style="display: none">{st.session_state.visualization_counter}</div>
            {create_visualization_html(st.session_state.repo_data)}
        """
        st.components.v1.html(html_content, height=1000)

if __name__ == "__main__":
    main()