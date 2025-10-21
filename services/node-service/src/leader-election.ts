import { Logger } from "@distributed/utils"

export class LeaderElection {
  private logger: Logger
  private currentLeader: string | null
  private currentTerm: number
  private votedFor: Map<number, string>
  private electionTimeout: number

  constructor(electionTimeout = 10000) {
    this.logger = new Logger("LeaderElection")
    this.currentLeader = null
    this.currentTerm = 0
    this.votedFor = new Map()
    this.electionTimeout = electionTimeout
  }

  getCurrentLeader(): string | null {
    return this.currentLeader
  }

  getCurrentTerm(): number {
    return this.currentTerm
  }

  electLeader(candidateId: string, term: number, activeNodes: string[]): boolean {
    this.logger.info("Leader election initiated", { candidateId, term, activeNodeCount: activeNodes.length })

    // If this is a new term, reset votes
    if (term > this.currentTerm) {
      this.currentTerm = term
      this.votedFor.clear()
    }

    // Check if we already voted in this term
    if (this.votedFor.has(term)) {
      const votedCandidate = this.votedFor.get(term)
      this.logger.info("Already voted in this term", { term, votedFor: votedCandidate })
      return votedCandidate === candidateId
    }

    // Simple election: first candidate to request in a term wins
    this.votedFor.set(term, candidateId)
    this.currentLeader = candidateId
    this.currentTerm = term

    this.logger.info("Leader elected", { leader: candidateId, term })
    return true
  }

  handleLeaderFailure(failedLeaderId: string, activeNodes: string[]): string | null {
    if (this.currentLeader !== failedLeaderId) {
      return this.currentLeader
    }

    this.logger.warn("Leader failed, initiating new election", { failedLeader: failedLeaderId })

    // Increment term and elect new leader
    this.currentTerm++
    this.votedFor.clear()

    // Select new leader from active nodes (simple: first active node)
    if (activeNodes.length > 0) {
      const newLeader = activeNodes[0]
      this.currentLeader = newLeader
      this.votedFor.set(this.currentTerm, newLeader)

      this.logger.info("New leader elected after failure", { newLeader, term: this.currentTerm })
      return newLeader
    }

    this.currentLeader = null
    this.logger.error("No active nodes available for leader election")
    return null
  }

  isLeader(nodeId: string): boolean {
    return this.currentLeader === nodeId
  }
}
