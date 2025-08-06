// ==UserScript==
// @name         Ultimate Web Editor Pro+
// @namespace    http://tampermonkey.net/
// @version      4.2
// @description  Advanced cross-platform web editor with HTML tools, state tracking, and site download
// @author       YourName
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// ==/UserScript==

(function() {
    'use strict';

    // Cross-platform detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isWindows = /Windows/i.test(navigator.userAgent);

    // Display creator info
    console.log('%cUltimate Web Editor Pro+ v4.2\n%cCreated by YourName', 
        'color: #28a745; font-size: 16px; font-weight: bold;', 
        'color: #333; font-size: 14px;');

    const doc = document;
    const storage = {
        get: (key, defaultValue) => GM_getValue(key, defaultValue),
        set: (key, value) => GM_setValue(key, value),
        getSiteKey: () => `site_${location.host}${location.pathname}`,
        getFontSize: () => parseInt(GM_getValue('editorFontSize', 14)),
        setFontSize: (size) => GM_setValue('editorFontSize', size),
        getWordWrap: () => GM_getValue('wordWrapEnabled', true),
        setWordWrap: (enabled) => GM_setValue('wordWrapEnabled', enabled)
    };

    let editMode = false;
    let isDragging = false;
    let startX = 0, startY = 0;
    let pressTimer = null;
    let contextMenu = null;
    let htmlEditor = null;
    let currentSearchIndex = 0;

    // Create main button with cross-platform support
    const createButton = () => {
        const btn = doc.createElement('div');
        btn.innerText = '🛠️';
        btn.setAttribute('title', 'Web Editor Pro+ by YourName');
        Object.assign(btn.style, {
            position: 'fixed',
            top: '100px',
            left: '20px',
            width: isMobile ? '60px' : '50px',
            height: isMobile ? '60px' : '50px',
            backgroundColor: '#222',
            color: '#fff',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: '999999',
            fontSize: isMobile ? '30px' : '24px',
            userSelect: 'none',
            touchAction: 'none',
            transition: 'transform 0.2s'
        });

        // Hover effect for desktop
        if (!isMobile) {
            btn.onmouseenter = () => btn.style.transform = 'scale(1.1)';
            btn.onmouseleave = () => btn.style.transform = 'scale(1)';
        }

        return btn;
    };

    // Enable edit mode
    const enableEditMode = () => {
        editMode = true;
        doc.body.contentEditable = true;
        doc.designMode = 'on';
        mainBtn.style.backgroundColor = '#28a745';
        storage.set('editModeEnabled', true);
        storage.set(storage.getSiteKey(), doc.documentElement.outerHTML);
    };

    // Disable edit mode
    const disableEditMode = () => {
        editMode = false;
        doc.body.contentEditable = false;
        doc.designMode = 'off';
        mainBtn.style.backgroundColor = '#222';
        storage.set('editModeEnabled', false);
    };

    // Toggle edit mode
    const toggleEditMode = () => {
        if (editMode) {
            disableEditMode();
        } else {
            enableEditMode();
        }
    };

    // Remove all UI elements
    const destroyUI = () => {
        disableEditMode();
        mainBtn.remove();
        if (contextMenu) contextMenu.remove();
        if (htmlEditor) htmlEditor.remove();
    };

    // Create context menu with cross-platform support
    const createContextMenu = () => {
        if (contextMenu) contextMenu.remove();
        
        contextMenu = doc.createElement('div');
        Object.assign(contextMenu.style, {
            position: 'fixed',
            top: isMobile ? '130px' : '60px',
            left: isMobile ? '30px' : '80px',
            backgroundColor: '#333',
            color: '#fff',
            borderRadius: '5px',
            padding: '10px',
            zIndex: '1000000',
            boxShadow: '0 0 10px rgba(0,0,0,0.5)',
            minWidth: isMobile ? '200px' : 'auto'
        });

        // Quick Edit button
        const quickEditBtn = doc.createElement('button');
        quickEditBtn.textContent = editMode ? '✖ Disable Quick Edit' : '✔ Enable Quick Edit';
        Object.assign(quickEditBtn.style, {
            display: 'block',
            marginBottom: '5px',
            width: '100%',
            padding: isMobile ? '12px 8px' : '8px',
            backgroundColor: editMode ? '#28a745' : '#dc3545',
            fontSize: isMobile ? '16px' : '14px'
        });
        quickEditBtn.addEventListener('click', () => {
            toggleEditMode();
            contextMenu.remove();
        });

        // HTML Editor button
        const htmlEditBtn = doc.createElement('button');
        htmlEditBtn.textContent = '🛠 Advanced HTML Editor';
        Object.assign(htmlEditBtn.style, {
            display: 'block',
            width: '100%',
            marginBottom: '5px',
            padding: isMobile ? '12px 8px' : '8px',
            fontSize: isMobile ? '16px' : '14px'
        });
        htmlEditBtn.addEventListener('click', () => {
            createHTMLEditor();
            contextMenu.remove();
        });

        // Auto-apply toggle
        const autoApplyToggle = doc.createElement('button');
        const autoApplyEnabled = storage.get('autoApplyEnabled', false);
        autoApplyToggle.textContent = autoApplyEnabled ? '✓ Auto-Apply (ON)' : '✗ Auto-Apply (OFF)';
        Object.assign(autoApplyToggle.style, {
            display: 'block',
            width: '100%',
            marginBottom: '5px',
            padding: isMobile ? '12px 8px' : '8px',
            backgroundColor: autoApplyEnabled ? '#28a745' : '#dc3545',
            fontSize: isMobile ? '16px' : '14px'
        });
        autoApplyToggle.addEventListener('click', () => {
            const newState = !storage.get('autoApplyEnabled', false);
            storage.set('autoApplyEnabled', newState);
            autoApplyToggle.textContent = newState ? '✓ Auto-Apply (ON)' : '✗ Auto-Apply (OFF)';
            autoApplyToggle.style.backgroundColor = newState ? '#28a745' : '#dc3545';
        });

        // Download Site button
        const downloadBtn = doc.createElement('button');
        downloadBtn.textContent = '⏬ Download Website';
        Object.assign(downloadBtn.style, {
            display: 'block',
            width: '100%',
            marginBottom: '5px',
            padding: isMobile ? '12px 8px' : '8px',
            fontSize: isMobile ? '16px' : '14px'
        });
        downloadBtn.addEventListener('click', () => {
            downloadCurrentSite();
            contextMenu.remove();
        });

        // Remove UI button
        const removeUIBtn = doc.createElement('button');
        removeUIBtn.textContent = '✖ Remove Editor UI';
        Object.assign(removeUIBtn.style, {
            display: 'block',
            width: '100%',
            padding: isMobile ? '12px 8px' : '8px',
            backgroundColor: '#ff3547',
            fontSize: isMobile ? '16px' : '14px'
        });
        removeUIBtn.addEventListener('click', destroyUI);

        contextMenu.appendChild(quickEditBtn);
        contextMenu.appendChild(htmlEditBtn);
        contextMenu.appendChild(autoApplyToggle);
        contextMenu.appendChild(downloadBtn);
        contextMenu.appendChild(removeUIBtn);
        doc.body.appendChild(contextMenu);
    };

    // Create HTML editor with enhanced features
    const createHTMLEditor = () => {
        if (htmlEditor) htmlEditor.remove();
        
        htmlEditor = doc.createElement('div');
        Object.assign(htmlEditor.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: isMobile ? '90vw' : '80vw',
            height: isMobile ? '80vh' : '80vh',
            backgroundColor: '#222',
            color: '#fff',
            borderRadius: '5px',
            padding: '20px',
            zIndex: '1000001',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 0 20px rgba(0,0,0,0.7)'
        });

        // Toolbar
        const toolbar = doc.createElement('div');
        Object.assign(toolbar.style, {
            display: 'flex',
            marginBottom: '10px',
            gap: '5px',
            flexWrap: 'wrap'
        });

        // Font size controls
        const fontSizeContainer = doc.createElement('div');
        Object.assign(fontSizeContainer.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
        });

        const fontSizeLabel = doc.createElement('span');
        fontSizeLabel.textContent = 'Font:';
        fontSizeLabel.style.marginRight = '5px';

        const decreaseFontBtn = doc.createElement('button');
        decreaseFontBtn.textContent = '-';
        decreaseFontBtn.style.padding = '2px 8px';
        decreaseFontBtn.addEventListener('click', () => {
            const currentSize = storage.getFontSize();
            if (currentSize > 8) {
                storage.setFontSize(currentSize - 1);
                editor.style.fontSize = `${currentSize - 1}px`;
            }
        });

        const fontSizeDisplay = doc.createElement('span');
        fontSizeDisplay.textContent = `${storage.getFontSize()}px`;
        fontSizeDisplay.style.minWidth = '40px';
        fontSizeDisplay.style.textAlign = 'center';

        const increaseFontBtn = doc.createElement('button');
        increaseFontBtn.textContent = '+';
        increaseFontBtn.style.padding = '2px 8px';
        increaseFontBtn.addEventListener('click', () => {
            const currentSize = storage.getFontSize();
            if (currentSize < 36) {
                storage.setFontSize(currentSize + 1);
                editor.style.fontSize = `${currentSize + 1}px`;
            }
        });

        fontSizeContainer.appendChild(fontSizeLabel);
        fontSizeContainer.appendChild(decreaseFontBtn);
        fontSizeContainer.appendChild(fontSizeDisplay);
        fontSizeContainer.appendChild(increaseFontBtn);

        // Word wrap toggle
        const wordWrapToggle = doc.createElement('button');
        let wordWrapEnabled = storage.getWordWrap();
        wordWrapToggle.textContent = wordWrapEnabled ? '☑ Word Wrap' : '☐ Word Wrap';
        wordWrapToggle.style.padding = '5px 8px';
        wordWrapToggle.addEventListener('click', () => {
            wordWrapEnabled = !wordWrapEnabled;
            storage.setWordWrap(wordWrapEnabled);
            wordWrapToggle.textContent = wordWrapEnabled ? '☑ Word Wrap' : '☐ Word Wrap';
            editor.style.whiteSpace = wordWrapEnabled ? 'pre-wrap' : 'pre';
            editor.style.overflowX = wordWrapEnabled ? 'auto' : 'scroll';
        });

        // Line number input
        const lineInput = doc.createElement('input');
        lineInput.type = 'number';
        lineInput.placeholder = 'Go to line...';
        lineInput.style.flex = '1';
        lineInput.style.minWidth = '100px';
        lineInput.style.padding = '5px';

        // Go to line button
        const gotoBtn = doc.createElement('button');
        gotoBtn.textContent = 'Go';
        gotoBtn.style.padding = '5px 10px';
        gotoBtn.addEventListener('click', () => {
            const lineNum = parseInt(lineInput.value);
            if (lineNum && lineNum > 0) {
                const lines = editor.value.split('\n');
                if (lineNum <= lines.length) {
                    const pos = lines.slice(0, lineNum-1).join('\n').length + (lineNum > 1 ? 1 : 0);
                    editor.focus();
                    editor.setSelectionRange(pos, pos);
                    editor.scrollTop = editor.scrollHeight * (lineNum / lines.length) - editor.clientHeight/2;
                }
            }
        });

        // Search input
        const searchInput = doc.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search...';
        searchInput.style.flex = '2';
        searchInput.style.minWidth = '150px';
        searchInput.style.padding = '5px';

        // Find button
        const findBtn = doc.createElement('button');
        findBtn.textContent = 'Find';
        findBtn.style.padding = '5px 10px';
        findBtn.addEventListener('click', () => {
            if (!searchInput.value) return;
            
            const content = editor.value;
            const searchStr = searchInput.value;
            const regex = new RegExp(escapeRegExp(searchStr), 'gi');
            let match;
            const matches = [];
            
            while ((match = regex.exec(content)) !== null) {
                matches.push(match);
            }
            
            if (matches.length === 0) {
                alert('Text not found');
                return;
            }
            
            currentSearchIndex = (currentSearchIndex + 1) % matches.length;
            const currentMatch = matches[currentSearchIndex];
            editor.focus();
            editor.setSelectionRange(currentMatch.index, currentMatch.index + searchStr.length);
            
            // Scroll to the match
            const lineHeight = parseInt(getComputedStyle(editor).lineHeight);
            const linesBefore = content.substr(0, currentMatch.index).split('\n').length - 1;
            editor.scrollTop = linesBefore * lineHeight - editor.clientHeight/2;
        });

        function escapeRegExp(string) {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        toolbar.appendChild(fontSizeContainer);
        toolbar.appendChild(wordWrapToggle);
        toolbar.appendChild(lineInput);
        toolbar.appendChild(gotoBtn);
        toolbar.appendChild(searchInput);
        toolbar.appendChild(findBtn);

        // Text editor
        const editor = doc.createElement('textarea');
        editor.value = doc.documentElement.outerHTML;
        Object.assign(editor.style, {
            flex: '1',
            fontFamily: 'monospace',
            whiteSpace: storage.getWordWrap() ? 'pre-wrap' : 'pre',
            overflow: 'auto',
            backgroundColor: '#111',
            color: '#fff',
            padding: '10px',
            border: 'none',
            borderRadius: '5px',
            fontSize: `${storage.getFontSize()}px`,
            lineHeight: '1.5'
        });

        // Button container
        const buttonContainer = doc.createElement('div');
        Object.assign(buttonContainer.style, {
            display: 'flex',
            gap: '10px',
            marginTop: '10px'
        });

        // Apply button (with smart partial updates)
        const applyBtn = doc.createElement('button');
        applyBtn.textContent = 'Apply Changes';
        applyBtn.style.flex = '1';
        applyBtn.style.padding = '8px';
        applyBtn.addEventListener('click', () => {
            try {
                const newDoc = new DOMParser().parseFromString(editor.value, 'text/html');
                
                // Track changes and only apply modified elements
                const allElements = [...newDoc.querySelectorAll('*')];
                const currentElements = [...doc.querySelectorAll('*')];
                let changesApplied = 0;
                
                for (let i = 0; i < Math.min(allElements.length, currentElements.length); i++) {
                    if (allElements[i].outerHTML !== currentElements[i].outerHTML) {
                        try {
                            currentElements[i].outerHTML = allElements[i].outerHTML;
                            changesApplied++;
                        } catch (e) {
                            console.warn(`Couldn't update element at index ${i}`, e);
                        }
                    }
                }
                
                storage.set(storage.getSiteKey(), doc.documentElement.outerHTML);
                htmlEditor.remove();
                alert(`Applied ${changesApplied} changes successfully!`);
            } catch (err) {
                alert('Error applying HTML: ' + err.message);
            }
        });

        // Save button
        const saveBtn = doc.createElement('button');
        saveBtn.textContent = 'Save Only';
        saveBtn.style.flex = '1';
        saveBtn.style.padding = '8px';
        saveBtn.addEventListener('click', () => {
            storage.set(storage.getSiteKey(), editor.value);
            alert('Changes saved! They will auto-apply on next page load.');
        });

        // Close button
        const closeBtn = doc.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.flex = '1';
        closeBtn.style.padding = '8px';
        closeBtn.addEventListener('click', () => {
            htmlEditor.remove();
        });

        buttonContainer.appendChild(applyBtn);
        buttonContainer.appendChild(saveBtn);
        buttonContainer.appendChild(closeBtn);

        htmlEditor.appendChild(toolbar);
        htmlEditor.appendChild(editor);
        htmlEditor.appendChild(buttonContainer);
        doc.body.appendChild(htmlEditor);
        editor.focus();
    };

    // Download current site as ZIP
    const downloadCurrentSite = async () => {
        try {
            const zip = new JSZip();
            const siteFolder = zip.folder(location.hostname);
            
            // Add main HTML
            siteFolder.file('index.html', doc.documentElement.outerHTML);
            
            // Add all stylesheets
            const styles = [...doc.querySelectorAll('link[rel="stylesheet"]')];
            await Promise.all(styles.map(async (link, i) => {
                if (link.href && link.href.startsWith('http')) {
                    try {
                        const response = await fetch(link.href);
                        const css = await response.text();
                        const path = new URL(link.href).pathname.split('/').pop() || `style-${i}.css`;
                        siteFolder.file(path, css);
                    } catch (e) {
                        console.warn(`Failed to fetch CSS: ${link.href}`, e);
                    }
                }
            }));
            
            // Generate and download ZIP
            const content = await zip.generateAsync({type: 'blob', compression: 'STORE'});
            const url = URL.createObjectURL(content);
            const filename = `${location.hostname}_${new Date().toISOString().slice(0,10)}.zip`;
            
            if (isMobile) {
                // For mobile devices
                const a = doc.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 100);
            } else {
                // For desktop
                GM_download({
                    url: url,
                    name: filename,
                    onload: () => URL.revokeObjectURL(url)
                });
            }
            
            alert('Site download started!');
        } catch (err) {
            alert('Error downloading site: ' + err.message);
        }
    };

    // Create and setup main button with cross-platform support
    const mainBtn = createButton();
    doc.body.appendChild(mainBtn);

    // Cross-platform event listeners
    if (isMobile) {
        // Mobile touch events
        mainBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            isDragging = false;
            pressTimer = setTimeout(() => {
                if (!isDragging) {
                    toggleEditMode();
                }
            }, 2000);
        });

        mainBtn.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                isDragging = true;
                clearTimeout(pressTimer);
                mainBtn.style.left = (touch.clientX - (mainBtn.offsetWidth/2)) + 'px';
                mainBtn.style.top = (touch.clientY - (mainBtn.offsetHeight/2)) + 'px';
            }
        });

        mainBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            clearTimeout(pressTimer);
            if (!isDragging) {
                createContextMenu();
            }
        });
    } else {
        // Desktop mouse events
        mainBtn.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            startY = e.clientY;
            isDragging = false;
            pressTimer = setTimeout(() => {
                if (!isDragging) {
                    toggleEditMode();
                }
            }, 2000);
        });

        mainBtn.addEventListener('mousemove', (e) => {
            if (e.buttons === 1) { // Left mouse button pressed
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    isDragging = true;
                    clearTimeout(pressTimer);
                    mainBtn.style.left = (e.clientX - (mainBtn.offsetWidth/2)) + 'px';
                    mainBtn.style.top = (e.clientY - (mainBtn.offsetHeight/2)) + 'px';
                }
            }
        });

        mainBtn.addEventListener('mouseup', () => {
            clearTimeout(pressTimer);
            if (!isDragging) {
                createContextMenu();
            }
        });

        mainBtn.addEventListener('click', (e) => {
            if (!isDragging) {
                createContextMenu();
            }
        });
    }

    // Apply saved state if auto-apply is enabled
    if (storage.get('autoApplyEnabled', false)) {
        const savedHTML = storage.get(storage.getSiteKey());
        if (savedHTML) {
            try {
                // Only apply changes to modified elements
                const newDoc = new DOMParser().parseFromString(savedHTML, 'text/html');
                const allElements = [...newDoc.querySelectorAll('*')];
                const currentElements = [...doc.querySelectorAll('*')];
                let changesApplied = 0;
                
                for (let i = 0; i < Math.min(allElements.length, currentElements.length); i++) {
                    if (allElements[i].outerHTML !== currentElements[i].outerHTML) {
                        try {
                            currentElements[i].outerHTML = allElements[i].outerHTML;
                            changesApplied++;
                        } catch (e) {
                            console.warn(`Couldn't auto-apply element at index ${i}`, e);
                        }
                    }
                }
                
                if (changesApplied > 0) {
                    console.log(`Auto-applied ${changesApplied} changes from saved state`);
                }
            } catch (err) {
                console.error('Error applying saved HTML:', err);
            }
        }
        
        if (storage.get('editModeEnabled', false)) {
            enableEditMode();
        }
    }
})();
