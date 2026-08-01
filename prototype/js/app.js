// js/app.js
window.app = {
    currentView: 'dashboard',
    
    switchView: function(viewId) {
        // 1. Manage Navigation Active State
        document.querySelectorAll('.nav-links button').forEach(b => b.classList.remove('active'));
        document.getElementById('nav-' + viewId).classList.add('active');
        
        // 2. Hide All Views
        document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
        
        // 3. Show Target View
        document.getElementById('view-' + viewId).classList.add('active');
        this.currentView = viewId;

        // 4. Performance Engine Management
        // Only run the active lab's math loop. Pause the others.
        if (viewId === 'bio') {
            window.bioLab.resume();
            window.physicsLab.pause();
        } else if (viewId === 'physics') {
            window.physicsLab.resume();
            window.bioLab.pause();
        } else {
            window.bioLab.pause();
            window.physicsLab.pause();
        }
    }
};