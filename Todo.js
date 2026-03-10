const listsContainer = document.querySelector('[data-lists]')
const newListForm = document.querySelector('[data-new-list-form]')
const newListInput = document.querySelector('[data-new-list-input]')
const deleteListButton = document.querySelector('[data-delete-list-button]')
const listDisplayContainer = document.querySelector('[data-list-display-container]')
const listTitleElement = document.querySelector('[data-list-title]')
const listCountElement = document.querySelector('[data-list-count]')
const tasksContainer = document.querySelector('[data-tasks]')
const taskTemplate = document.getElementById('task-template')
const newTaskForm = document.querySelector('[data-new-task-form]')
const newTaskInput = document.querySelector('[data-new-task-input]')
const clearCompleteTasksButton = document.querySelector('[data-clear-complete-tasks-button]')
const newTaskPriority = document.querySelector('[data-new-task-priority]')
const newTaskDate = document.querySelector('[data-new-task-date]')

const LOCAL_STORAGE_LIST_KEY = 'task.lists'
const LOCAL_STORAGE_SELECTED_LIST_ID_KEY = 'task.selectedListId'
let lists = JSON.parse(localStorage.getItem(LOCAL_STORAGE_LIST_KEY)) || []
let selectedListId = localStorage.getItem(LOCAL_STORAGE_SELECTED_LIST_ID_KEY)

listsContainer.addEventListener('click', e => {
  if (e.target.tagName.toLowerCase() === 'li') {
    selectedListId = e.target.dataset.listId
    saveAndRender()
  }
})

tasksContainer.addEventListener('click', e => {
  if (e.target.tagName.toLowerCase() === 'input') {
    const selectedList = lists.find(list => list.id === selectedListId)
    const selectedTask = selectedList.tasks.find(task => task.id === e.target.id)
    selectedTask.complete = e.target.checked
    save()
    renderTaskCount(selectedList)
  }
})

clearCompleteTasksButton.addEventListener('click', e => {
  const selectedList = lists.find(list => list.id === selectedListId)
  selectedList.tasks = selectedList.tasks.filter(task => !task.complete)
  saveAndRender()
})

deleteListButton.addEventListener('click', e => {
  lists = lists.filter(list => list.id !== selectedListId)
  selectedListId = null
  saveAndRender()
})

newListForm.addEventListener('submit', e => {
  e.preventDefault()
  const listName = newListInput.value
  if (listName == null || listName === '') return
  const list = createList(listName)
  newListInput.value = null
  lists.push(list)
  saveAndRender()
})

newTaskForm.addEventListener('submit', e => {
  e.preventDefault()
  const taskName = newTaskInput.value
  const priority = newTaskPriority.value
  const dueDate = newTaskDate.value
  if (taskName == null || taskName === '') return
  const task = createTask(taskName, priority, dueDate)
  newTaskInput.value = null
  newTaskDate.value = null
  const selectedList = lists.find(list => list.id === selectedListId)
  selectedList.tasks.push(task)
  saveAndRender()
})

function createList(name) {
  return { id: Date.now().toString(), name: name, tasks: [] }
}

function createTask(name, priority, dueDate) {
  return { 
    id: Date.now().toString(), 
    name: name, 
    complete: false,
    priority: priority || 'medium',
    dueDate: dueDate || null
  }
}

function saveAndRender() {
  save()
  render()
}

function save() {
  localStorage.setItem(LOCAL_STORAGE_LIST_KEY, JSON.stringify(lists))
  localStorage.setItem(LOCAL_STORAGE_SELECTED_LIST_ID_KEY, selectedListId)
}

function render() {
  clearElement(listsContainer)
  renderLists()

  const selectedList = lists.find(list => list.id === selectedListId)
  if (selectedListId == null) {
    listDisplayContainer.style.display = 'none'
  } else {
    listDisplayContainer.style.display = ''
    listTitleElement.innerText = selectedList.name
    renderTaskCount(selectedList)
    clearElement(tasksContainer)
    renderTasks(selectedList)
  }
}

function renderTasks(selectedList) {
selectedList.tasks.forEach(task => {
    const taskElement = document.importNode(taskTemplate.content, true)
    const taskDiv = taskElement.querySelector('.task')
    const checkbox = taskElement.querySelector('input')
    const label = taskElement.querySelector('label')
    const nameText = taskElement.querySelector('.task-name-text')
    const priorityBadge = taskElement.querySelector('.priority-badge')
    const dateDisplay = taskElement.querySelector('.due-date-display')

    taskDiv.dataset.taskId = task.id
    checkbox.id = task.id
    checkbox.checked = task.complete
    label.htmlFor = task.id
    nameText.innerText = task.name

    taskElement.querySelector('.task-name-text').innerText = task.name

    // Priority Badge
    if (task.priority) {
      priorityBadge.innerText = task.priority
      priorityBadge.classList.add(`priority-${task.priority}`)
    } else {
      priorityBadge.style.display = 'none'
    }

    // Due Date Logic
    if (task.dueDate) {
      dateDisplay.innerText = task.dueDate
      const today = new Date()
      const due = new Date(task.dueDate)
      const timeDiff = due - today
      const daysDiff = timeDiff / (1000 * 3600 * 24)
      if (daysDiff <= 2 && daysDiff >= 0) {
          dateDisplay.classList.add('due-soon')
      }
    } else {
      dateDisplay.style.display = 'none'
    }

    // Drag listeners
    taskDiv.addEventListener('dragstart', () => taskDiv.classList.add('dragging'))
    taskDiv.addEventListener('dragend', () => taskDiv.classList.remove('dragging'))
    tasksContainer.appendChild(taskElement)
  })
}

function renderTaskCount(selectedList) {
  const incompleteTaskCount = selectedList.tasks.filter(task => !task.complete).length
  const taskString = incompleteTaskCount === 1 ? "task" : "tasks"
  listCountElement.innerText = `${incompleteTaskCount} ${taskString} remaining`
}

function renderLists() {
  lists.forEach(list => {
    const listElement = document.createElement('li')
    listElement.dataset.listId = list.id
    listElement.classList.add("list-name")
    listElement.innerText = list.name
    if (list.id === selectedListId) {
      listElement.classList.add('active-list')
    }
    listsContainer.appendChild(listElement)
  })
}

function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild)
  }
}
render()

// --- DRAG AND DROP REORDERING LOGIC ---

tasksContainer.addEventListener('dragover', e => {
  e.preventDefault() // Required to allow dropping
  const afterElement = getDragAfterElement(tasksContainer, e.clientY)
  const draggable = document.querySelector('.dragging')
  
  if (afterElement == null) {
    tasksContainer.appendChild(draggable)
  } else {
    tasksContainer.insertBefore(draggable, afterElement)
  }
})

tasksContainer.addEventListener('drop', e => {
  e.preventDefault()
  const selectedList = lists.find(list => list.id === selectedListId)
  
  // Get the new order of task IDs directly from the HTML DOM
  const currentTaskElements = [...tasksContainer.querySelectorAll('.task')]
  const newTaskIds = currentTaskElements.map(taskEl => taskEl.dataset.taskId)
  
  // Sort the actual javascript array to match the new DOM order
  selectedList.tasks.sort((a, b) => {
    return newTaskIds.indexOf(a.id) - newTaskIds.indexOf(b.id)
  })
  
  saveAndRender() // Save the new order to local storage
})

// Helper function to calculate exactly where the task should be dropped
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.task:not(.dragging)')]

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect()
    const offset = y - box.top - box.height / 2
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child }
    } else {
      return closest
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element
}