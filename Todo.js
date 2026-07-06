(function () {
  "use strict";

  const LS_LISTS = "board.lists";
  const LS_SELECTED = "board.selectedListId";
  const LS_DUE_SOON = "board.dueSoonDays";
  const LS_SORT = "board.sortMode";

  // ---------- DOM refs ----------
  const listsContainer = document.querySelector('[data-lists]');
  const newListForm = document.querySelector('[data-new-list-form]');
  const newListInput = document.querySelector('[data-new-list-input]');
  const board = document.querySelector('[data-board]');
  const emptyBoardTemplate = document.getElementById('empty-board-template');
  const taskCardTemplate = document.getElementById('task-card-template');
  const toastTemplate = document.getElementById('toast-template');
  const toastRack = document.querySelector('[data-toast-rack]');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- State ----------
  let lists = loadLists();
  let selectedListId = localStorage.getItem(LS_SELECTED) || (lists[0] && lists[0].id) || null;
  let editingTaskId = null;
  let renamingListId = null;      // list currently in rename mode
  let justAddedTaskId = null;     // triggers card-enter animation
  let justCompletedTaskId = null; // triggers stamp-pop + confetti
  let newTabId = null;            // triggers tab-enter animation
  let draggingTaskId = null;      // task currently being dragged, for cross-list drops
  let draggingListId = null;      // list tab currently being dragged, for reordering lists
  let dueSoonDays = loadDueSoonDays();
  let sortMode = localStorage.getItem(LS_SORT) || 'manual'; // 'manual' | 'due-asc' | 'due-desc'
  let dueSoonPopoverOpen = false;

  const SORT_ICON = {
    manual: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>',
    'due-asc': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/><path d="M11 12h4"/><path d="M11 16h7"/><path d="M11 20h10"/></svg>',
    'due-desc': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M11 4h10"/><path d="M11 8h7"/><path d="M11 12h4"/></svg>'
  };
  const SORT_TITLE = {
    manual: 'Manual order — click to sort by due date, soonest first',
    'due-asc': 'Sorted: soonest due first — click to sort latest first',
    'due-desc': 'Sorted: latest due first — click to return to manual order'
  };

  function loadDueSoonDays() {
    const raw = localStorage.getItem(LS_DUE_SOON);
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 2;
  }

  function loadLists() {
    try {
      const raw = localStorage.getItem(LS_LISTS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) { /* fall through to seed data */ }
    return seedData();
  }

  function seedData() {
    return [
      {
        id: 'l1', name: 'This Week',
        tasks: [
          { id: 't1', name: 'Reply to the Martinez proposal', complete: false, priority: 'high', dueDate: addDays(1) },
          { id: 't2', name: 'Water the office plants', complete: false, priority: 'low', dueDate: null },
          { id: 't3', name: 'Book dentist appointment', complete: true, priority: 'medium', dueDate: addDays(-2) },
        ]
      },
      {
        id: 'l2', name: 'Someday',
        tasks: [
          { id: 't4', name: 'Learn to make sourdough', complete: false, priority: 'low', dueDate: null },
        ]
      }
    ];
  }

  function addDays(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function uid() {
    return 'id' + Math.random().toString(36).slice(2, 9);
  }

  function persist() {
    localStorage.setItem(LS_LISTS, JSON.stringify(lists));
    localStorage.setItem(LS_SELECTED, selectedListId || '');
  }

  function getSelectedList() {
    return lists.find(l => l.id === selectedListId);
  }

  // ---------- Toasts ----------
  function showToast(text) {
    const frag = toastTemplate.content.cloneNode(true);
    const toastEl = frag.querySelector('.toast');
    toastEl.querySelector('.toast-text').textContent = text;
    toastRack.appendChild(toastEl);
    requestAnimationFrame(() => toastEl.classList.add('show'));
    setTimeout(() => {
      toastEl.classList.remove('show');
      toastEl.classList.add('hide');
      toastEl.addEventListener('transitionend', () => toastEl.remove(), { once: true });
      setTimeout(() => toastEl.remove(), 500); // fallback
    }, 2400);
  }

  // ---------- Confetti burst ----------
  function burstConfetti(originEl, colorVar) {
    if (prefersReducedMotion) return;
    const boardRect = board.getBoundingClientRect();
    const originRect = originEl.getBoundingClientRect();
    const originX = originRect.left - boardRect.left + originRect.width / 2;
    const originY = originRect.top - boardRect.top + originRect.height / 2;
    const colors = [colorVar, '#F3ECD9', '#D7A63A'];

    for (let i = 0; i < 8; i++) {
      const bit = document.createElement('span');
      bit.className = 'confetti-bit';
      bit.style.left = originX + 'px';
      bit.style.top = originY + 'px';
      bit.style.background = colors[i % colors.length];
      board.appendChild(bit);

      const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
      const dist = 30 + Math.random() * 26;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 10;

      requestAnimationFrame(() => {
        bit.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.random() * 360}deg)`;
        bit.style.opacity = '0';
      });
      setTimeout(() => bit.remove(), 700);
    }
  }

  function focusCardControl(taskId, selector) {
    requestAnimationFrame(() => {
      const el = board.querySelector(`.card[data-task-id="${taskId}"] ${selector}`);
      if (el) el.focus();
    });
  }

  function focusNewTaskInput() {
    requestAnimationFrame(() => {
      const el = board.querySelector('[data-new-task-input]');
      if (el) el.focus();
    });
  }

  function focusActiveListTab() {
    requestAnimationFrame(() => {
      const el = listsContainer.querySelector('.list-tab.active') || newListInput;
      if (el) el.focus();
    });
  }

  function focusRenameButton(listId) {
    requestAnimationFrame(() => {
      const el = listsContainer.querySelector(`[data-list-id="${listId}"] [data-rename-btn]`);
      if (el) el.focus();
    });
  }

  function focusDueSoonToggle() {
    requestAnimationFrame(() => {
      const el = board.querySelector('[data-due-soon-toggle]');
      if (el) el.focus();
    });
  }

  // ---------- List sidebar events ----------
  listsContainer.addEventListener('click', e => {
    const renameBtn = e.target.closest('[data-rename-btn]');
    if (renameBtn) {
      const tab = renameBtn.closest('.list-tab');
      startRenaming(tab.dataset.listId);
      return;
    }
    const tab = e.target.closest('.list-tab');
    if (!tab) return;
    selectTab(tab, false);
  });

  listsContainer.addEventListener('dblclick', e => {
    const nameEl = e.target.closest('.tab-name');
    if (!nameEl) return;
    const tab = nameEl.closest('.list-tab');
    if (!tab) return;
    startRenaming(tab.dataset.listId);
  });

  listsContainer.addEventListener('keydown', e => {
    // While a rename input is focused, let it handle its own keys except Escape.
    if (e.target.matches('.tab-name-input')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        const listId = renamingListId;
        renamingListId = null;
        render();
        focusRenameButton(listId);
      }
      return;
    }

    const tab = e.target.closest('.list-tab');
    if (!tab) return;

    if (e.key === 'F2') {
      e.preventDefault();
      startRenaming(tab.dataset.listId);
      return;
    }

    const tabs = [...listsContainer.querySelectorAll('.list-tab')];
    const idx = tabs.indexOf(tab);

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      selectTab(tabs[(idx + 1) % tabs.length], true);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      selectTab(tabs[(idx - 1 + tabs.length) % tabs.length], true);
    } else if (e.key === 'Home') {
      e.preventDefault();
      selectTab(tabs[0], true);
    } else if (e.key === 'End') {
      e.preventDefault();
      selectTab(tabs[tabs.length - 1], true);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectTab(tab, true);
    }
  });

  function selectTab(tab, keepFocus) {
    if (!tab || tab.dataset.listId === selectedListId) {
      if (keepFocus) tab.focus();
      return;
    }
    selectedListId = tab.dataset.listId;
    editingTaskId = null;
    persist();
    render();
    if (keepFocus) {
      const newTab = listsContainer.querySelector(`[data-list-id="${selectedListId}"]`);
      if (newTab) newTab.focus();
    }
  }

  // ---------- Rename a list ----------
  function startRenaming(listId) {
    renamingListId = listId;
    editingTaskId = null;
    render();
  }

  function commitRename(listId, rawName) {
    const list = lists.find(l => l.id === listId);
    renamingListId = null;
    if (!list) { render(); return; }
    const name = rawName.trim();
    if (name && name !== list.name) {
      list.name = name;
      persist();
      render();
      focusRenameButton(listId);
      showToast(`Renamed list to "${name}"`);
    } else {
      // empty or unchanged — just drop out of rename mode
      render();
      focusRenameButton(listId);
    }
  }

  // ---------- Drag a list tab to reorder lists, or drag a task card onto a list tab to move it there ----------
  listsContainer.addEventListener('dragstart', e => {
    const tab = e.target.closest('.list-tab');
    if (!tab || tab.draggable === false) return;
    tab.classList.add('dragging');
    draggingListId = tab.dataset.listId;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', tab.dataset.listId); } catch (err) {}
  });

  listsContainer.addEventListener('dragend', e => {
    const tab = e.target.closest('.list-tab');
    if (tab) tab.classList.remove('dragging');
    draggingListId = null;
  });

  listsContainer.addEventListener('dragover', e => {
    if (draggingListId) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const dragging = listsContainer.querySelector('.list-tab.dragging');
      if (!dragging) return;
      const after = getListDragAfterElement(listsContainer, e.clientY);
      if (after == null) listsContainer.appendChild(dragging);
      else listsContainer.insertBefore(dragging, after);
      return;
    }

    if (!draggingTaskId) return;
    const tab = e.target.closest('.list-tab');
    if (!tab) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (tab.dataset.listId !== selectedListId) tab.classList.add('drop-target');
  });

  listsContainer.addEventListener('dragleave', e => {
    const tab = e.target.closest('.list-tab');
    if (tab) tab.classList.remove('drop-target');
  });

  listsContainer.addEventListener('drop', e => {
    if (draggingListId) {
      e.preventDefault();
      const orderedIds = [...listsContainer.querySelectorAll('.list-tab')].map(li => li.dataset.listId);
      lists.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
      persist();
      return;
    }

    const tab = e.target.closest('.list-tab');
    if (!tab || !draggingTaskId) return;
    e.preventDefault();
    tab.classList.remove('drop-target');
    moveTaskToList(draggingTaskId, tab.dataset.listId);
  });

  function getListDragAfterElement(container, y) {
    const els = [...container.querySelectorAll('.list-tab:not(.dragging)')];
    return els.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  function moveTaskToList(taskId, targetListId) {
    if (targetListId === selectedListId) return; // dropped on its own list, nothing to do
    const sourceList = getSelectedList();
    const targetList = lists.find(l => l.id === targetListId);
    if (!sourceList || !targetList) return;
    const taskIndex = sourceList.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;
    const task = sourceList.tasks[taskIndex];
    const cardEl = board.querySelector(`.card[data-task-id="${taskId}"]`);

    const finish = () => {
      sourceList.tasks.splice(taskIndex, 1);
      targetList.tasks.unshift(task);
      persist();
      render();
      focusNewTaskInput();
      showToast(`Moved "${task.name}" to "${targetList.name}"`);
    };

    if (cardEl) animateOutThenRun([cardEl], finish);
    else finish();
  }

  newListForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = newListInput.value.trim();
    if (!name) return;
    const list = { id: uid(), name, tasks: [] };
    lists.push(list);
    selectedListId = list.id;
    newTabId = list.id;
    newListInput.value = '';
    persist();
    render();
    showToast(`Pinned a new list: "${name}"`);
  });

  // ---------- Board (delegated) events ----------
  board.addEventListener('submit', e => {
    if (e.target.matches('[data-new-task-form]')) {
      e.preventDefault();
      const form = e.target;
      const nameInput = form.querySelector('[data-new-task-input]');
      const priority = form.querySelector('[data-new-task-priority]').value;
      const dueDate = form.querySelector('[data-new-task-date]').value;
      const name = nameInput.value.trim();
      if (!name) return;
      const list = getSelectedList();
      const task = { id: uid(), name, complete: false, priority: priority || 'medium', dueDate: dueDate || null };
      list.tasks.unshift(task);
      justAddedTaskId = task.id;
      persist();

      const submitBtn = form.querySelector('.stamp-submit');
      if (submitBtn) submitBtn.classList.add('thumped');

      render();
      return;
    }

    if (e.target.matches('[data-edit-form]')) {
      e.preventDefault();
      const form = e.target;
      const nameInput = form.querySelector('.task-name-input');
      const priorityInput = form.querySelector('.task-priority-input');
      const dateInput = form.querySelector('.task-date-input');
      const card = form.closest('.card');
      const taskId = card.dataset.taskId;
      const list = getSelectedList();
      const task = list.tasks.find(t => t.id === taskId);
      const value = nameInput.value.trim();
      if (value) task.name = value;
      task.priority = priorityInput.value;
      task.dueDate = dateInput.value || null;
      editingTaskId = null;
      persist();
      render();
      focusCardControl(taskId, '[data-edit-btn]');
    }
  });

  board.addEventListener('click', e => {
    if (e.target.closest('[data-sort-btn]')) {
      sortMode = sortMode === 'manual' ? 'due-asc' : sortMode === 'due-asc' ? 'due-desc' : 'manual';
      localStorage.setItem(LS_SORT, sortMode);
      renderBoard();
      return;
    }

    if (e.target.closest('[data-due-soon-toggle]')) {
      dueSoonPopoverOpen = !dueSoonPopoverOpen;
      renderBoard();
      if (dueSoonPopoverOpen) {
        requestAnimationFrame(() => {
          const input = board.querySelector('[data-due-soon-input]');
          if (input) { input.focus(); input.select(); }
        });
      }
      return;
    }

    if (e.target.matches('[data-clear-complete]')) {
      const list = getSelectedList();
      const completedCards = [...board.querySelectorAll('.card')].filter(c => {
        const t = list.tasks.find(tt => tt.id === c.dataset.taskId);
        return t && t.complete;
      });
      const count = completedCards.length;
      if (count === 0) return;
      animateOutThenRun(completedCards, () => {
        list.tasks = list.tasks.filter(t => !t.complete);
        persist();
        render();
        focusNewTaskInput();
        showToast(count === 1 ? 'Cleared 1 finished task' : `Cleared ${count} finished tasks`);
      });
      return;
    }

    if (e.target.matches('[data-delete-list]')) {
      const list = getSelectedList();
      const name = list.name;
      lists = lists.filter(l => l.id !== selectedListId);
      selectedListId = lists.length ? lists[0].id : null;
      persist();
      render();
      focusActiveListTab();
      showToast(`Deleted "${name}"`);
      return;
    }

    const editBtn = e.target.closest('[data-edit-btn]');
    if (editBtn) {
      const card = editBtn.closest('.card');
      editingTaskId = card.dataset.taskId;
      render();
      return;
    }

    const cancelBtn = e.target.closest('[data-cancel-edit-btn]');
    if (cancelBtn) {
      const taskId = cancelBtn.closest('.card').dataset.taskId;
      editingTaskId = null;
      render();
      focusCardControl(taskId, '[data-edit-btn]');
      return;
    }

    const deleteBtn = e.target.closest('[data-delete-btn]');
    if (deleteBtn) {
      const card = deleteBtn.closest('.card');
      const list = getSelectedList();
      animateOutThenRun([card], () => {
        list.tasks = list.tasks.filter(t => t.id !== card.dataset.taskId);
        persist();
        render();
        focusNewTaskInput();
      });
      return;
    }
  });

  board.addEventListener('change', e => {
    if (e.target.matches('[data-due-soon-input]')) {
      const val = parseInt(e.target.value, 10);
      dueSoonDays = Number.isFinite(val) && val >= 0 ? val : 0;
      e.target.value = dueSoonDays;
      localStorage.setItem(LS_DUE_SOON, String(dueSoonDays));
      refreshDueHighlighting();
      return;
    }

    if (e.target.matches('.card input[type="checkbox"]')) {
      const card = e.target.closest('.card');
      const list = getSelectedList();
      const task = list.tasks.find(t => t.id === card.dataset.taskId);
      task.complete = e.target.checked;
      persist();

      if (task.complete) {
        justCompletedTaskId = task.id;
        const stamp = card.querySelector('.stamp');
        if (stamp) {
          stamp.classList.remove('stamp-pop');
          void stamp.offsetWidth; // restart animation
          stamp.classList.add('stamp-pop');
        }
        const pinColor = getComputedStyle(document.documentElement)
          .getPropertyValue(task.priority === 'high' ? '--pin-high' : task.priority === 'low' ? '--pin-low' : '--pin-medium');
        burstConfetti(card.querySelector('.check-mark'), pinColor.trim());
      }
      bumpCountChip();
      renderCounts();
      return;
    }
  });

  board.addEventListener('focusout', e => {
    const form = e.target.closest('[data-edit-form]');
    if (!form || !editingTaskId) return;
    // Only auto-commit once focus has left the entire edit form (not just moved
    // between its own fields), so tabbing from name -> priority -> date works.
    if (form.contains(e.relatedTarget)) return;
    form.requestSubmit();
  });

  board.addEventListener('keydown', e => {
    if (e.key === 'Escape' && e.target.closest('[data-edit-form]')) {
      editingTaskId = null;
      render();
      return;
    }
    if (e.key === 'Escape' && dueSoonPopoverOpen) {
      dueSoonPopoverOpen = false;
      renderBoard();
      focusDueSoonToggle();
    }
  });

  // ---------- Close the due-soon popover on outside click ----------
  document.addEventListener('click', e => {
    if (!dueSoonPopoverOpen) return;
    if (e.target.closest('.popover-wrap')) return;
    dueSoonPopoverOpen = false;
    renderBoard();
  });

  // ---------- List rename form + blur handling ----------
  listsContainer.addEventListener('submit', e => {
    if (!e.target.matches('[data-rename-form]')) return;
    e.preventDefault();
    const input = e.target.querySelector('.tab-name-input');
    commitRename(e.target.closest('.list-tab').dataset.listId, input.value);
  });

  listsContainer.addEventListener('focusout', e => {
    const form = e.target.closest('[data-rename-form]');
    if (!form || !renamingListId) return;
    if (form.contains(e.relatedTarget)) return;
    form.requestSubmit();
  });

  // ---------- Drag & drop reorder ----------
  board.addEventListener('dragstart', e => {
    const card = e.target.closest('.card');
    if (card && card.draggable) {
      card.classList.add('dragging');
      draggingTaskId = card.dataset.taskId;
      e.dataTransfer.effectAllowed = 'move';
      // Firefox requires setData for the drag to initiate at all
      try { e.dataTransfer.setData('text/plain', card.dataset.taskId); } catch (err) {}
    }
  });
  board.addEventListener('dragend', e => {
    const card = e.target.closest('.card');
    if (card) card.classList.remove('dragging');
    draggingTaskId = null;
    listsContainer.querySelectorAll('.list-tab.drop-target').forEach(t => t.classList.remove('drop-target'));
  });
  board.addEventListener('dragover', e => {
    const cardsEl = board.querySelector('.cards');
    if (!cardsEl) return;
    e.preventDefault();
    const dragging = board.querySelector('.dragging');
    if (!dragging) return;

    if (sortMode === 'manual') {
      const after = getDragAfterElement(cardsEl, e.clientY);
      if (after == null) cardsEl.appendChild(dragging);
      else cardsEl.insertBefore(dragging, after);
      return;
    }

    // While a due-date sort is active, only allow reordering among cards
    // that share the exact same due date as the one being dragged — this
    // breaks ties without disturbing the overall date order.
    const list = getSelectedList();
    const draggedTask = list && list.tasks.find(t => t.id === draggingTaskId);
    if (!draggedTask || !draggedTask.dueDate) return;
    const sameDateCards = [...cardsEl.querySelectorAll('.card:not(.dragging)')].filter(c => {
      const t = list.tasks.find(tt => tt.id === c.dataset.taskId);
      return t && t.dueDate === draggedTask.dueDate;
    });
    if (sameDateCards.length === 0) return;
    const after = closestAfterElement(sameDateCards, e.clientY);
    if (after == null) sameDateCards[sameDateCards.length - 1].after(dragging);
    else cardsEl.insertBefore(dragging, after);
  });
  board.addEventListener('drop', e => {
    e.preventDefault();
    const cardsEl = board.querySelector('.cards');
    if (!cardsEl) return;
    const list = getSelectedList();

    if (sortMode !== 'manual') {
      const draggedTask = list.tasks.find(t => t.id === draggingTaskId);
      if (draggedTask && draggedTask.dueDate) {
        const orderedIdsForDate = [...cardsEl.querySelectorAll('.card')]
          .map(c => c.dataset.taskId)
          .filter(id => {
            const t = list.tasks.find(tt => tt.id === id);
            return t && t.dueDate === draggedTask.dueDate;
          });
        reorderTiedGroup(list, orderedIdsForDate);
        persist();
      }
      return;
    }

    const orderedIds = [...cardsEl.querySelectorAll('.card')].map(c => c.dataset.taskId);
    list.tasks.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
    persist();
  });

  // Reorders just the tasks in `orderedIds` (all sharing one due date) to match
  // that new relative order, leaving every other task's position untouched.
  function reorderTiedGroup(list, orderedIds) {
    const groupSet = new Set(orderedIds);
    const byId = {};
    list.tasks.forEach(t => { if (groupSet.has(t.id)) byId[t.id] = t; });
    const newTasks = [];
    let inserted = false;
    list.tasks.forEach(t => {
      if (groupSet.has(t.id)) {
        if (!inserted) {
          orderedIds.forEach(id => newTasks.push(byId[id]));
          inserted = true;
        }
      } else {
        newTasks.push(t);
      }
    });
    list.tasks = newTasks;
  }

  function closestAfterElement(els, y) {
    return els.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  function getDragAfterElement(container, y) {
    const els = [...container.querySelectorAll('.card:not(.dragging)')];
    return closestAfterElement(els, y);
  }

  // ---------- Exit animation helper ----------
  function animateOutThenRun(cardEls, callback) {
    if (prefersReducedMotion || cardEls.length === 0) {
      callback();
      return;
    }
    let remaining = cardEls.length;
    cardEls.forEach(card => {
      card.classList.add('card-exit');
      card.addEventListener('animationend', done, { once: true });
      setTimeout(done, 320); // fallback in case animationend doesn't fire
    });
    let finished = false;
    function done() {
      remaining -= 1;
      if (remaining <= 0 && !finished) {
        finished = true;
        callback();
      }
    }
  }

  function bumpCountChip() {
    const tab = listsContainer.querySelector(`[data-list-id="${selectedListId}"] .count-chip`);
    if (!tab) return;
    tab.classList.remove('bump');
    void tab.offsetWidth;
    tab.classList.add('bump');
  }

  // ---------- Rendering ----------
  function getDisplayTasks(list) {
    if (sortMode === 'manual') return list.tasks;
    const withDate = list.tasks.filter(t => t.dueDate);
    const withoutDate = list.tasks.filter(t => !t.dueDate);
    withDate.sort((a, b) => sortMode === 'due-asc'
      ? a.dueDate.localeCompare(b.dueDate)
      : b.dueDate.localeCompare(a.dueDate));
    return [...withDate, ...withoutDate];
  }

  function render() {
    renderLists();
    renderBoard();
  }

  function renderLists() {
    listsContainer.innerHTML = '';
    lists.forEach(list => {
      const isActive = list.id === selectedListId;
      const isRenaming = list.id === renamingListId;
      const li = document.createElement('li');
      li.className = 'list-tab' + (isActive ? ' active' : '');
      li.dataset.listId = list.id;
      li.setAttribute('role', 'tab');
      li.setAttribute('aria-selected', isActive ? 'true' : 'false');
      li.setAttribute('aria-controls', 'board-panel');
      li.tabIndex = isActive ? 0 : -1;
      li.draggable = !isRenaming;
      if (list.id === newTabId) li.classList.add('tab-enter');

      if (isRenaming) {
        const form = document.createElement('form');
        form.className = 'tab-rename-form';
        form.setAttribute('data-rename-form', '');

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'tab-name-input';
        input.value = list.name;
        input.setAttribute('aria-label', `Rename list "${list.name}"`);
        input.autocomplete = 'off';

        form.appendChild(input);
        li.appendChild(form);
        li.tabIndex = -1;

        requestAnimationFrame(() => {
          input.focus();
          input.select();
        });
      } else {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'tab-name';
        nameSpan.textContent = list.name;

        const renameBtn = document.createElement('button');
        renameBtn.type = 'button';
        renameBtn.className = 'rename-btn';
        renameBtn.setAttribute('data-rename-btn', '');
        renameBtn.setAttribute('aria-label', `Rename "${list.name}"`);
        renameBtn.title = 'Rename list';
        renameBtn.textContent = '✎';

        const remaining = list.tasks.filter(t => !t.complete).length;
        const chip = document.createElement('span');
        chip.className = 'count-chip';
        chip.textContent = remaining;

        li.appendChild(nameSpan);
        li.appendChild(renameBtn);
        li.appendChild(chip);
      }

      listsContainer.appendChild(li);
    });
    newTabId = null;
  }

  function renderBoard() {
    board.innerHTML = '';
    const list = getSelectedList();

    const inner = document.createElement('div');
    inner.className = 'board-inner';

    if (!list) {
      inner.appendChild(emptyBoardTemplate.content.cloneNode(true));
      board.appendChild(inner);
      return;
    }

    const header = document.createElement('div');
    header.className = 'board-header';
    header.innerHTML = `
      <h2></h2>
      <div class="meta">
        <span data-count></span>
        <div class="tool-group">
          <button class="icon-toggle-btn${sortMode !== 'manual' ? ' active' : ''}" data-sort-btn type="button" title="${SORT_TITLE[sortMode]}" aria-label="${SORT_TITLE[sortMode]}">${SORT_ICON[sortMode]}</button>
          <div class="popover-wrap">
            <button class="icon-toggle-btn${dueSoonPopoverOpen ? ' active' : ''}" data-due-soon-toggle type="button" title="Due-soon highlight settings" aria-label="Due-soon highlight settings" aria-haspopup="true" aria-expanded="${dueSoonPopoverOpen}">⚙</button>
            ${dueSoonPopoverOpen ? `
            <div class="popover" data-due-soon-popover role="dialog" aria-label="Due-soon highlight settings">
              <label class="popover-row">
                <span>Highlight due within</span>
                <input type="number" min="0" max="30" step="1" data-due-soon-input value="${dueSoonDays}" aria-label="Highlight tasks due within this many days" />
                <span>days</span>
              </label>
            </div>` : ''}
          </div>
        </div>
        <button class="text-btn danger" data-delete-list type="button">delete this list</button>
      </div>
    `;
    header.querySelector('h2').textContent = list.name;
    inner.appendChild(header);

    const progressTrack = document.createElement('div');
    progressTrack.className = 'progress-track';
    progressTrack.innerHTML = `<div class="progress-fill" data-progress-fill></div>`;
    inner.appendChild(progressTrack);

    const composer = document.createElement('div');
    composer.className = 'composer';
    composer.innerHTML = `
      <form data-new-task-form>
        <div style="flex:1 1 220px;">
          <span class="field-label">Task</span>
          <label class="sr-only" for="new-task-input">New task name</label>
          <input id="new-task-input" type="text" data-new-task-input placeholder="what needs doing…" autocomplete="off" />
        </div>
        <div>
          <span class="field-label">Priority</span>
          <select data-new-task-priority aria-label="Priority">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <span class="field-label">Due</span>
          <input type="date" data-new-task-date aria-label="Due date" />
        </div>
        <button class="stamp-submit" type="submit">Pin it</button>
      </form>
    `;
    inner.appendChild(composer);

    const cardsEl = document.createElement('div');
    cardsEl.className = 'cards';

    if (list.tasks.length === 0) {
      const empty = document.createElement('p');
      empty.style.cssText = "font-family:'Caveat',cursive; font-size:1.3rem; color: rgba(243,236,217,0.75); text-align:center; padding: 2rem 0;";
      empty.textContent = 'nothing pinned yet — add the first thing above';
      cardsEl.appendChild(empty);
    } else {
      const displayTasks = getDisplayTasks(list);
      const dateCounts = {};
      displayTasks.forEach(t => { if (t.dueDate) dateCounts[t.dueDate] = (dateCounts[t.dueDate] || 0) + 1; });
      displayTasks.forEach((task, idx) => cardsEl.appendChild(buildCard(task, idx, displayTasks.length, dateCounts)));
    }
    inner.appendChild(cardsEl);

    const footer = document.createElement('div');
    footer.className = 'board-footer';
    footer.innerHTML = `<button class="text-btn" data-clear-complete type="button">clear completed</button>`;
    inner.appendChild(footer);

    board.appendChild(inner);

    justAddedTaskId = null;
    renderCounts();
  }

  function buildCard(task, index, total, dateCounts) {
    const frag = taskCardTemplate.content.cloneNode(true);
    const card = frag.querySelector('.card');
    const checkbox = frag.querySelector('input[type="checkbox"]');
    const label = frag.querySelector('label');
    const pin = frag.querySelector('.pin');
    const nameEl = frag.querySelector('.task-name');
    const badge = frag.querySelector('.badge');
    const due = frag.querySelector('.due');
    const editBtn = frag.querySelector('[data-edit-btn]');
    const deleteBtn = frag.querySelector('[data-delete-btn]');

    card.dataset.taskId = task.id;
    const hasTieToBreak = task.dueDate && dateCounts && dateCounts[task.dueDate] > 1;
    card.draggable = sortMode === 'manual' || hasTieToBreak;
    if (sortMode !== 'manual' && hasTieToBreak) {
      card.title = 'Drag to reorder tasks due on this date';
    }
    if (task.id === justAddedTaskId) card.classList.add('card-enter');

    checkbox.id = 'chk-' + task.id;
    checkbox.checked = task.complete;
    label.htmlFor = checkbox.id;

    pin.classList.add('priority-' + task.priority);
    badge.classList.add('priority-' + task.priority);
    badge.textContent = task.priority;

    editBtn.setAttribute('aria-label', `Edit "${task.name}"`);
    deleteBtn.setAttribute('aria-label', `Remove "${task.name}"`);

    if (editingTaskId === task.id) {
      const bodySpan = frag.querySelector('.card-body');
      bodySpan.innerHTML = '';
      const form = document.createElement('form');
      form.className = 'edit-form';
      form.setAttribute('data-edit-form', '');
      form.innerHTML = `
        <input class="task-name-input" type="text" value="${escapeAttr(task.name)}" aria-label="Edit task name" />
        <div class="edit-fields">
          <select class="task-priority-input" aria-label="Edit priority">
            <option value="low"${task.priority === 'low' ? ' selected' : ''}>Low</option>
            <option value="medium"${task.priority === 'medium' ? ' selected' : ''}>Medium</option>
            <option value="high"${task.priority === 'high' ? ' selected' : ''}>High</option>
          </select>
          <input type="date" class="task-date-input" value="${task.dueDate ? escapeAttr(task.dueDate) : ''}" aria-label="Edit due date" />
          <button type="submit" class="icon-btn edit-save-btn">save</button>
          <button type="button" class="icon-btn" data-cancel-edit-btn>cancel</button>
        </div>
      `;
      bodySpan.appendChild(form);
      requestAnimationFrame(() => {
        const input = form.querySelector('.task-name-input');
        input.focus();
        input.select();
      });
    } else {
      nameEl.textContent = task.name;
    }

    if (task.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(task.dueDate + 'T00:00:00');
      const daysDiff = (dueDate - today) / (1000 * 3600 * 24);
      due.textContent = formatDate(task.dueDate);
      if (daysDiff < 0) due.classList.add('overdue');
      else if (daysDiff <= dueSoonDays) due.classList.add('due-soon');
    } else {
      due.remove();
    }

    return frag;
  }

  function refreshDueHighlighting() {
    const list = getSelectedList();
    if (!list) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    list.tasks.forEach(task => {
      if (!task.dueDate) return;
      const card = board.querySelector(`.card[data-task-id="${task.id}"]`);
      const due = card && card.querySelector('.due');
      if (!due) return;
      const dueDate = new Date(task.dueDate + 'T00:00:00');
      const daysDiff = (dueDate - today) / (1000 * 3600 * 24);
      due.classList.remove('overdue', 'due-soon');
      if (daysDiff < 0) due.classList.add('overdue');
      else if (daysDiff <= dueSoonDays) due.classList.add('due-soon');
    });
  }

  function formatDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function renderCounts() {
    const list = getSelectedList();
    if (!list) return;
    const countEl = board.querySelector('[data-count]');
    if (countEl) {
      const remaining = list.tasks.filter(t => !t.complete).length;
      countEl.textContent = remaining + (remaining === 1 ? ' task left' : ' tasks left');
    }
    const fill = board.querySelector('[data-progress-fill]');
    if (fill) {
      const total = list.tasks.length;
      const done = list.tasks.filter(t => t.complete).length;
      const pct = total === 0 ? 0 : Math.round((done / total) * 100);
      requestAnimationFrame(() => { fill.style.width = pct + '%'; });
    }
    const tab = listsContainer.querySelector(`[data-list-id="${list.id}"] .count-chip`);
    if (tab) tab.textContent = list.tasks.filter(t => !t.complete).length;
  }

  render();
})();
