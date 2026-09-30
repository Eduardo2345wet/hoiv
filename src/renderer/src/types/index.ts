export type FocusConnectionType = 'prerequisite' | 'mutually_exclusive'

export interface FocusNode {
  id: string
  name: string
  description: string
  cost: number
  icon: string
  x: number
  y: number
  availableCode: string
  bypassCode: string
  rewardCode: string
  prereqs: string[]
  exclusives: string[]
}

export interface ModProject {
  modName: string
  tag: string
  focuses: FocusNode[]
}
