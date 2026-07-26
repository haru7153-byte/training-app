export type QuestionInputType = 'single-choice'

export interface QuestionOption {
  id: string
  label: string
}

export interface QuestionDefinition {
  id: string
  prompt: string
  type: QuestionInputType
  options: QuestionOption[]
}

/** question id -> selected option id */
export type QuestionAnswers = Record<string, string>
