/**
 * Forms Store - Centralizes all form-related state management
 * 
 * Manages state for all forms across the application including validation,
 * submission, error handling, and form lifecycle. This store consolidates
 * form state patterns used across multiple components.
 * 
 * AIDEV-NOTE: This centralizes form state from 15+ form components and provides
 * consistent validation, error handling, and submission patterns.
 */

import { Store } from '@tanstack/react-store'

export interface FormFieldState {
  value: any
  error: string | null
  touched: boolean
  dirty: boolean
  validating: boolean
}

export interface FormValidationRule {
  type: 'required' | 'email' | 'minLength' | 'maxLength' | 'pattern' | 'custom'
  value?: any
  message: string
  validator?: (value: any, formData: Record<string, any>) => boolean | Promise<boolean>
}

export interface FormConfig {
  id: string
  title: string
  fields: Record<string, {
    type: 'text' | 'email' | 'password' | 'number' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'textarea' | 'file' | 'date' | 'time'
    label: string
    placeholder?: string
    required?: boolean
    disabled?: boolean
    readonly?: boolean
    hidden?: boolean
    rules?: FormValidationRule[]
    options?: Array<{ value: any; label: string; disabled?: boolean }>
    multiple?: boolean
    accept?: string // for file inputs
    min?: number
    max?: number
    step?: number
    rows?: number // for textarea
    cols?: number
    defaultValue?: any
    dependsOn?: string // field dependency
    conditional?: (formData: Record<string, any>) => boolean
  }>
  submitText?: string
  cancelText?: string
  resetText?: string
  autoSave?: boolean
  validateOnChange?: boolean
  validateOnBlur?: boolean
  resetOnSubmit?: boolean
}

export interface FormInstance {
  id: string
  config: FormConfig
  fields: Record<string, FormFieldState>
  isSubmitting: boolean
  isValidating: boolean
  isDirty: boolean
  isValid: boolean
  submitCount: number
  errors: Record<string, string>
  touched: Record<string, boolean>
  submitted: boolean
  submitError: string | null
  submitSuccess: boolean
  lastSubmitAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface FormsState {
  // Active forms registry
  forms: Record<string, FormInstance>
  
  // Current active form
  activeFormId: string | null
  
  // Global form settings
  globalSettings: {
    autoSave: boolean
    autoSaveInterval: number
    validateOnChange: boolean
    validateOnBlur: boolean
    showErrorsOnSubmit: boolean
    confirmOnNavigate: boolean
    maxFileSize: number
    allowedFileTypes: string[]
  }
  
  // Specific form states for major forms
  agentCreateForm: {
    isOpen: boolean
    editingAgentId: string | null
    step: number
    maxSteps: number
    data: {
      name: string
      description: string
      role: string
      capabilities: string[]
      teamIds: number[]
      configuration: Record<string, any>
    }
  }
  
  teamForm: {
    isOpen: boolean
    editingTeamId: number | null
    data: {
      name: string
      description: string
      visibility: 'public' | 'private'
      agentIds: string[]
      memberEmails: string[]
    }
  }
  
  databaseForm: {
    isOpen: boolean
    editingDatabaseId: number | null
    data: {
      name: string
      description: string
      type: 'postgresql' | 'mysql' | 'sqlite'
      connectionString: string
    }
  }
  
  tableForm: {
    isOpen: boolean
    editingTableId: number | null
    selectedDatabaseId: number | null
    data: {
      name: string
      description: string
      databaseId: number | null
    }
  }
  
  fieldForm: {
    isOpen: boolean
    editingFieldId: number | null
    tableId: number | null
    data: {
      name: string
      type: string
      required: boolean
      defaultValue: any
      relationTable: number | null
      description: string
    }
  }
  
  userInviteForm: {
    isOpen: boolean
    data: {
      emails: string[]
      role: 'admin' | 'member' | 'viewer'
      teamIds: number[]
      message: string
    }
  }
  
  roleForm: {
    isOpen: boolean
    editingRoleId: number | null
    data: {
      name: string
      description: string
      permissions: string[]
      color: string
    }
  }
  
  connectionForm: {
    isOpen: boolean
    appId: string | null
    data: {
      name: string
      description: string
      credentials: Record<string, any>
    }
  }
  
  scheduleForm: {
    isOpen: boolean
    agentId: string | null
    taskId: string | null
    data: {
      title: string
      description: string
      startDate: Date | null
      frequency: 'once' | 'daily' | 'weekly' | 'monthly'
      interval: number
      endDate: Date | null
      timezone: string
    }
  }
  
  taskForm: {
    isOpen: boolean
    agentId: string | null
    data: {
      title: string
      description: string
      instruction: string
      priority: 'low' | 'medium' | 'high' | 'urgent'
      dueDate: Date | null
      assignedTo: string | null
      tags: string[]
    }
  }
  
  // Bulk operations
  bulkEditForm: {
    isOpen: boolean
    selectedIds: string[]
    entityType: 'agents' | 'teams' | 'tasks' | 'fields'
    fields: Record<string, any>
  }
  
  // Import/Export forms
  importForm: {
    isOpen: boolean
    entityType: 'agents' | 'teams' | 'tables' | 'rows'
    file: File | null
    mappings: Record<string, string>
    progress: number
  }
  
  exportForm: {
    isOpen: boolean
    entityType: 'agents' | 'teams' | 'tables' | 'rows'
    format: 'csv' | 'json' | 'xlsx'
    filters: Record<string, any>
    selectedIds: string[]
  }
  
  // Form wizard state
  wizards: Record<string, {
    currentStep: number
    maxStep: number
    steps: Array<{
      id: string
      title: string
      description: string
      completed: boolean
      valid: boolean
    }>
    canGoBack: boolean
    canGoForward: boolean
    showStepNumbers: boolean
  }>
  
  // Auto-save state
  autoSave: Record<string, {
    enabled: boolean
    interval: number
    lastSaved: Date | null
    pending: boolean
    data: Record<string, any>
  }>
  
  // Form templates
  templates: Record<string, {
    id: string
    name: string
    description: string
    config: FormConfig
    category: string
    tags: string[]
    createdAt: Date
    updatedAt: Date
    usageCount: number
  }>
}

const initialState: FormsState = {
  forms: {},
  activeFormId: null,
  
  globalSettings: {
    autoSave: true,
    autoSaveInterval: 30000, // 30 seconds
    validateOnChange: true,
    validateOnBlur: true,
    showErrorsOnSubmit: true,
    confirmOnNavigate: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: ['image/*', '.pdf', '.doc', '.docx', '.txt', '.csv', '.xlsx']
  },
  
  agentCreateForm: {
    isOpen: false,
    editingAgentId: null,
    step: 1,
    maxSteps: 4,
    data: {
      name: '',
      description: '',
      role: '',
      capabilities: [],
      teamIds: [],
      configuration: {}
    }
  },
  
  teamForm: {
    isOpen: false,
    editingTeamId: null,
    data: {
      name: '',
      description: '',
      visibility: 'public',
      agentIds: [],
      memberEmails: []
    }
  },
  
  databaseForm: {
    isOpen: false,
    editingDatabaseId: null,
    data: {
      name: '',
      description: '',
      type: 'postgresql',
      connectionString: ''
    }
  },
  
  tableForm: {
    isOpen: false,
    editingTableId: null,
    selectedDatabaseId: null,
    data: {
      name: '',
      description: '',
      databaseId: null
    }
  },
  
  fieldForm: {
    isOpen: false,
    editingFieldId: null,
    tableId: null,
    data: {
      name: '',
      type: 'text',
      required: false,
      defaultValue: undefined,
      relationTable: null,
      description: ''
    }
  },
  
  userInviteForm: {
    isOpen: false,
    data: {
      emails: [],
      role: 'member',
      teamIds: [],
      message: ''
    }
  },
  
  roleForm: {
    isOpen: false,
    editingRoleId: null,
    data: {
      name: '',
      description: '',
      permissions: [],
      color: '#3B82F6'
    }
  },
  
  connectionForm: {
    isOpen: false,
    appId: null,
    data: {
      name: '',
      description: '',
      credentials: {}
    }
  },
  
  scheduleForm: {
    isOpen: false,
    agentId: null,
    taskId: null,
    data: {
      title: '',
      description: '',
      startDate: null,
      frequency: 'once',
      interval: 1,
      endDate: null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  },
  
  taskForm: {
    isOpen: false,
    agentId: null,
    data: {
      title: '',
      description: '',
      instruction: '',
      priority: 'medium',
      dueDate: null,
      assignedTo: null,
      tags: []
    }
  },
  
  bulkEditForm: {
    isOpen: false,
    selectedIds: [],
    entityType: 'agents',
    fields: {}
  },
  
  importForm: {
    isOpen: false,
    entityType: 'agents',
    file: null,
    mappings: {},
    progress: 0
  },
  
  exportForm: {
    isOpen: false,
    entityType: 'agents',
    format: 'csv',
    filters: {},
    selectedIds: []
  },
  
  wizards: {},
  autoSave: {},
  templates: {}
}

// Create the forms store
export const formsStore = new Store(initialState)

// Store actions for forms management
export const formsActions = {
  // Generic form actions
  createForm: (config: FormConfig) => {
    const formInstance: FormInstance = {
      id: config.id,
      config,
      fields: Object.keys(config.fields).reduce((acc, fieldName) => {
        acc[fieldName] = {
          value: config.fields[fieldName].defaultValue || '',
          error: null,
          touched: false,
          dirty: false,
          validating: false
        }
        return acc
      }, {} as Record<string, FormFieldState>),
      isSubmitting: false,
      isValidating: false,
      isDirty: false,
      isValid: true,
      submitCount: 0,
      errors: {},
      touched: {},
      submitted: false,
      submitError: null,
      submitSuccess: false,
      lastSubmitAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    formsStore.setState((state) => ({
      ...state,
      forms: {
        ...state.forms,
        [config.id]: formInstance
      }
    }))

    return formInstance
  },

  setActiveForm: (formId: string | null) => {
    formsStore.setState((state) => ({ ...state, activeFormId: formId }))
  },

  updateFormField: (formId: string, fieldName: string, value: any) => {
    formsStore.setState((state) => {
      const form = state.forms[formId]
      if (!form) return state

      return {
        ...state,
        forms: {
          ...state.forms,
          [formId]: {
            ...form,
            fields: {
              ...form.fields,
              [fieldName]: {
                ...form.fields[fieldName],
                value,
                dirty: true,
                touched: true
              }
            },
            isDirty: true,
            updatedAt: new Date()
          }
        }
      }
    })
  },

  setFormFieldError: (formId: string, fieldName: string, error: string | null) => {
    formsStore.setState((state) => {
      const form = state.forms[formId]
      if (!form) return state

      return {
        ...state,
        forms: {
          ...state.forms,
          [formId]: {
            ...form,
            fields: {
              ...form.fields,
              [fieldName]: {
                ...form.fields[fieldName],
                error
              }
            },
            errors: {
              ...form.errors,
              [fieldName]: error || ''
            }
          }
        }
      }
    })
  },

  setFormSubmitting: (formId: string, isSubmitting: boolean) => {
    formsStore.setState((state) => {
      const form = state.forms[formId]
      if (!form) return state

      return {
        ...state,
        forms: {
          ...state.forms,
          [formId]: {
            ...form,
            isSubmitting,
            submitError: isSubmitting ? null : form.submitError
          }
        }
      }
    })
  },

  setFormSubmitError: (formId: string, error: string | null) => {
    formsStore.setState((state) => {
      const form = state.forms[formId]
      if (!form) return state

      return {
        ...state,
        forms: {
          ...state.forms,
          [formId]: {
            ...form,
            submitError: error,
            isSubmitting: false,
            submitSuccess: !error
          }
        }
      }
    })
  },

  resetForm: (formId: string) => {
    formsStore.setState((state) => {
      const form = state.forms[formId]
      if (!form) return state

      const resetFields = Object.keys(form.config.fields).reduce((acc, fieldName) => {
        acc[fieldName] = {
          value: form.config.fields[fieldName].defaultValue || '',
          error: null,
          touched: false,
          dirty: false,
          validating: false
        }
        return acc
      }, {} as Record<string, FormFieldState>)

      return {
        ...state,
        forms: {
          ...state.forms,
          [formId]: {
            ...form,
            fields: resetFields,
            isDirty: false,
            isValid: true,
            errors: {},
            touched: {},
            submitted: false,
            submitError: null,
            submitSuccess: false,
            updatedAt: new Date()
          }
        }
      }
    })
  },

  deleteForm: (formId: string) => {
    formsStore.setState((state) => {
      const newForms = { ...state.forms }
      delete newForms[formId]

      return {
        ...state,
        forms: newForms,
        activeFormId: state.activeFormId === formId ? null : state.activeFormId
      }
    })
  },

  // Specific form actions - Agent Create Form
  setAgentCreateForm: (isOpen: boolean, editingAgentId: string | null = null) => {
    formsStore.setState((state) => ({
      ...state,
      agentCreateForm: {
        ...state.agentCreateForm,
        isOpen,
        editingAgentId: isOpen ? editingAgentId : null,
        step: isOpen ? 1 : state.agentCreateForm.step
      }
    }))
  },

  updateAgentCreateForm: (data: Partial<FormsState['agentCreateForm']['data']>) => {
    formsStore.setState((state) => ({
      ...state,
      agentCreateForm: {
        ...state.agentCreateForm,
        data: { ...state.agentCreateForm.data, ...data }
      }
    }))
  },

  setAgentCreateFormStep: (step: number) => {
    formsStore.setState((state) => ({
      ...state,
      agentCreateForm: {
        ...state.agentCreateForm,
        step: Math.max(1, Math.min(step, state.agentCreateForm.maxSteps))
      }
    }))
  },

  // Team Form actions
  setTeamForm: (isOpen: boolean, editingTeamId: number | null = null) => {
    formsStore.setState((state) => ({
      ...state,
      teamForm: {
        ...state.teamForm,
        isOpen,
        editingTeamId: isOpen ? editingTeamId : null
      }
    }))
  },

  updateTeamForm: (data: Partial<FormsState['teamForm']['data']>) => {
    formsStore.setState((state) => ({
      ...state,
      teamForm: {
        ...state.teamForm,
        data: { ...state.teamForm.data, ...data }
      }
    }))
  },

  // Database Form actions
  setDatabaseForm: (isOpen: boolean, editingDatabaseId: number | null = null) => {
    formsStore.setState((state) => ({
      ...state,
      databaseForm: {
        ...state.databaseForm,
        isOpen,
        editingDatabaseId: isOpen ? editingDatabaseId : null
      }
    }))
  },

  updateDatabaseForm: (data: Partial<FormsState['databaseForm']['data']>) => {
    formsStore.setState((state) => ({
      ...state,
      databaseForm: {
        ...state.databaseForm,
        data: { ...state.databaseForm.data, ...data }
      }
    }))
  },

  // Table Form actions
  setTableForm: (isOpen: boolean, editingTableId: number | null = null, selectedDatabaseId: number | null = null) => {
    formsStore.setState((state) => ({
      ...state,
      tableForm: {
        ...state.tableForm,
        isOpen,
        editingTableId: isOpen ? editingTableId : null,
        selectedDatabaseId: isOpen ? selectedDatabaseId : null
      }
    }))
  },

  updateTableForm: (data: Partial<FormsState['tableForm']['data']>) => {
    formsStore.setState((state) => ({
      ...state,
      tableForm: {
        ...state.tableForm,
        data: { ...state.tableForm.data, ...data }
      }
    }))
  },

  // Field Form actions
  setFieldForm: (isOpen: boolean, editingFieldId: number | null = null, tableId: number | null = null) => {
    formsStore.setState((state) => ({
      ...state,
      fieldForm: {
        ...state.fieldForm,
        isOpen,
        editingFieldId: isOpen ? editingFieldId : null,
        tableId: isOpen ? tableId : null
      }
    }))
  },

  updateFieldForm: (data: Partial<FormsState['fieldForm']['data']>) => {
    formsStore.setState((state) => ({
      ...state,
      fieldForm: {
        ...state.fieldForm,
        data: { ...state.fieldForm.data, ...data }
      }
    }))
  },

  // Task Form actions
  setTaskForm: (isOpen: boolean, agentId: string | null = null) => {
    formsStore.setState((state) => ({
      ...state,
      taskForm: {
        ...state.taskForm,
        isOpen,
        agentId: isOpen ? agentId : null
      }
    }))
  },

  updateTaskForm: (data: Partial<FormsState['taskForm']['data']>) => {
    formsStore.setState((state) => ({
      ...state,
      taskForm: {
        ...state.taskForm,
        data: { ...state.taskForm.data, ...data }
      }
    }))
  },

  // Schedule Form actions
  setScheduleForm: (isOpen: boolean, agentId: string | null = null, taskId: string | null = null) => {
    formsStore.setState((state) => ({
      ...state,
      scheduleForm: {
        ...state.scheduleForm,
        isOpen,
        agentId: isOpen ? agentId : null,
        taskId: isOpen ? taskId : null
      }
    }))
  },

  updateScheduleForm: (data: Partial<FormsState['scheduleForm']['data']>) => {
    formsStore.setState((state) => ({
      ...state,
      scheduleForm: {
        ...state.scheduleForm,
        data: { ...state.scheduleForm.data, ...data }
      }
    }))
  },

  // Global settings actions
  updateGlobalSettings: (settings: Partial<FormsState['globalSettings']>) => {
    formsStore.setState((state) => ({
      ...state,
      globalSettings: { ...state.globalSettings, ...settings }
    }))
  },

  // Wizard actions
  createWizard: (wizardId: string, steps: FormsState['wizards'][string]['steps']) => {
    formsStore.setState((state) => ({
      ...state,
      wizards: {
        ...state.wizards,
        [wizardId]: {
          currentStep: 0,
          maxStep: steps.length - 1,
          steps,
          canGoBack: false,
          canGoForward: steps[0]?.valid || false,
          showStepNumbers: true
        }
      }
    }))
  },

  updateWizardStep: (wizardId: string, step: number) => {
    formsStore.setState((state) => {
      const wizard = state.wizards[wizardId]
      if (!wizard) return state

      return {
        ...state,
        wizards: {
          ...state.wizards,
          [wizardId]: {
            ...wizard,
            currentStep: Math.max(0, Math.min(step, wizard.maxStep)),
            canGoBack: step > 0,
            canGoForward: step < wizard.maxStep && wizard.steps[step + 1]?.valid
          }
        }
      }
    })
  },

  // Reset actions
  reset: () => {
    formsStore.setState(initialState)
  },

  resetAllForms: () => {
    formsStore.setState((state) => ({
      ...state,
      forms: {},
      activeFormId: null
    }))
  }
}

// Common selectors for forms state
export const formsSelectors = {
  // Generic form selectors
  getForm: (formId: string) => (state: FormsState) => state.forms[formId],
  activeForm: (state: FormsState) => state.activeFormId ? state.forms[state.activeFormId] : null,
  isFormOpen: (formId: string) => (state: FormsState) => !!state.forms[formId],
  
  // Specific form selectors
  agentCreateForm: (state: FormsState) => state.agentCreateForm,
  teamForm: (state: FormsState) => state.teamForm,
  databaseForm: (state: FormsState) => state.databaseForm,
  tableForm: (state: FormsState) => state.tableForm,
  fieldForm: (state: FormsState) => state.fieldForm,
  taskForm: (state: FormsState) => state.taskForm,
  scheduleForm: (state: FormsState) => state.scheduleForm,
  
  // Form state checks
  hasOpenForms: (state: FormsState) => Object.keys(state.forms).length > 0,
  hasDirtyForms: (state: FormsState) => Object.values(state.forms).some(form => form.isDirty),
  hasSubmittingForms: (state: FormsState) => Object.values(state.forms).some(form => form.isSubmitting),
  
  // Global settings
  globalSettings: (state: FormsState) => state.globalSettings,
  
  // Wizard selectors
  getWizard: (wizardId: string) => (state: FormsState) => state.wizards[wizardId],
  
  // Auto-save selectors
  getAutoSave: (formId: string) => (state: FormsState) => state.autoSave[formId]
}

