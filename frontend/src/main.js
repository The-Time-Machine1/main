import './styles/main.css';
import './styles/visualization.css';
import { TreeVisualizer } from './visualizer/TreeVisualizer';

class RepositoryVisualizer {
    constructor() {
        this.visualizer = null;
        this.isInitializing = false;
        
        // Check for initial data from Streamlit
        if (window.initialRepoData) {
            console.log('Initial repository data detected from Streamlit');
            this.initializeWithData(window.initialRepoData);
        } else {
            this.initializeUI();
        }
    }

    /**
     * Initialize with data provided by Streamlit
     */
    async initializeWithData(data) {
        console.log('Initializing with provided data:', data);
        try {
            await this.initializeUI();
            
            if (this.visualizer && data.nodes && data.edges) {
                this.updateProgress(50, 'Rendering visualization...');
                await this.visualizer.visualizeData(data);
                this.updateDiagnostics('Visualization initialized with provided data');
                this.updateProgress(100, 'Complete');
            }
        } catch (error) {
            console.error('Error initializing with data:', error);
            this.updateDiagnostics(`Error: ${error.message}`, 'error');
            this.updateProgress(0, 'failed');
        }
    }

    /**
     * Fetch the OpenAI key from the backend and set window.OPENAI_API_KEY
     */
    async loadOpenAIKey() {
        try {
            const res = await fetch('/api/v1/config/openai-key');
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || 'Failed to load OpenAI key');
            }
            const data = await res.json();
            window.OPENAI_API_KEY = data.key; 
            console.log('Loaded OpenAI key successfully');
        } catch (err) {
            console.error('Error loading OpenAI key:', err);
            this.updateDiagnostics(`Error loading OpenAI key: ${err.message}`, 'error');
        }
    }

    async initializeUI() {
        console.log('Initializing application...');

        // Load the OpenAI API key before we do anything else
        await this.loadOpenAIKey();

        // Initialize visualizer
        try {
            const visualizationContainer = document.getElementById('visualization');
            if (!visualizationContainer) {
                throw new Error('Visualization container not found');
            }

            this.visualizer = new TreeVisualizer('visualization');
            console.log('TreeVisualizer initialized');
            
            // Clear any existing progress display
            this.updateProgress(0, '');
            this.clearDiagnostics();
            
            // Setup communication with Streamlit
            this.setupStreamlitCommunication();
            
            console.log('Application initialized successfully');
            return true;

        } catch (error) {
            console.error('Error initializing application:', error);
            this.updateDiagnostics(`Initialization error: ${error.message}`, 'error');
            this.updateProgress(0, 'failed');
            return false;
        }
    }

    setupStreamlitCommunication() {
        // Listen for messages from Streamlit
        window.addEventListener('message', async (event) => {
            const data = event.data;
            console.log('Received message from Streamlit:', data);

            if (data.type === 'analyze' && data.payload) {
                await this.handleAnalyzeData(data.payload);
            } else if (data.type === 'clear') {
                this.clearVisualization();
            }
        });
    }

    async handleAnalyzeData(data) {
        if (this.isInitializing) {
            console.log('Analysis already in progress, please wait...');
            return;
        }

        try {
            this.isInitializing = true;
            
            // Reset state
            this.updateProgress(0, 'Initializing...');
            this.clearDiagnostics();
            this.updateDiagnostics(`Processing repository data...`);
            
            // Clear previous visualization
            if (this.visualizer) {
                this.visualizer.clearVisualization();
            }

            this.updateProgress(80, 'Rendering visualization...');

            // Update visualization
            if (this.visualizer) {
                await this.visualizer.visualizeData(data);
                this.updateDiagnostics('Analysis completed successfully');
                this.updateProgress(100, 'Complete');
            } else {
                throw new Error('Visualizer not initialized');
            }

        } catch (error) {
            console.error('Error during analysis:', error);
            this.updateDiagnostics(`Error: ${error.message}`, 'error');
            this.updateProgress(0, 'failed');
        } finally {
            this.isInitializing = false;
        }
    }

    clearVisualization() {
        if (this.visualizer) {
            this.visualizer.clearVisualization();
            this.clearDiagnostics();
            this.updateProgress(0, '');
        }
    }

    updateDiagnostics(message, type = 'info') {
        const diagnosticsContent = document.getElementById('diagnosticsContent');
        if (!diagnosticsContent) return;

        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `diagnostic-entry ${type}`;
        entry.innerHTML = `${timestamp} - ${message}`;
        diagnosticsContent.appendChild(entry);
        diagnosticsContent.scrollTop = diagnosticsContent.scrollHeight;

        // Send diagnostics to Streamlit
        if (window.parent) {
            window.parent.postMessage({
                type: 'diagnostics',
                message: `${timestamp} - ${message}`,
                messageType: type
            }, '*');
        }
    }

    clearDiagnostics() {
        const diagnosticsContent = document.getElementById('diagnosticsContent');
        if (diagnosticsContent) {
            diagnosticsContent.innerHTML = '';
        }
    }

    updateProgress(percentage, status = '') {
        const progressContainer = document.querySelector('.progress-container');
        const progressFill = document.querySelector('.progress-fill');
        const progressPercentage = document.querySelector('.progress-percentage');
        const progressStatus = document.querySelector('.progress-status');

        if (!progressContainer || !progressFill || !progressPercentage || !progressStatus) {
            console.error('Progress elements not found');
            return;
        }

        // Show/hide progress based on status
        if (status === '') {
            progressContainer.classList.add('hidden');
        } else {
            progressContainer.classList.remove('hidden');
        }

        // Update progress bar
        progressFill.style.width = `${percentage}%`;
        progressPercentage.textContent = `${percentage}%`;
        
        // Update status text
        switch (status) {
            case 'failed':
                progressContainer.classList.add('failed');
                progressStatus.textContent = 'Analysis failed';
                break;
            case '':
                progressContainer.classList.remove('failed');
                progressStatus.textContent = '';
                break;
            default:
                progressContainer.classList.remove('failed');
                progressStatus.textContent = status;
        }

        // Send progress to Streamlit
        if (window.parent) {
            window.parent.postMessage({
                type: 'progress',
                percentage,
                status
            }, '*');
        }
    }

    dispose() {
        if (this.visualizer) {
            this.visualizer.dispose();
            this.visualizer = null;
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.app = new RepositoryVisualizer();
        console.log('RepoViz application started');
    } catch (error) {
        console.error('Failed to start application:', error);
        // Try to show error in diagnostics even if initialization failed
        const diagnosticsContent = document.getElementById('diagnosticsContent');
        if (diagnosticsContent) {
            diagnosticsContent.innerHTML = `<div class="diagnostic-entry error">${new Date().toLocaleTimeString()} - Fatal error: ${error.message}</div>`;
        }
    }
});

export default RepositoryVisualizer;