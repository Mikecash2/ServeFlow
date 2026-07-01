import { Injectable } from "@nestjs/common";
import { IntentClassifierService } from "./intent-classifier.service";
import { AssistantQueriesRepository } from "./assistant-queries.repository";
import { ServicesRepository } from "../services/services.repository";
import { ServiceRolesRepository } from "../service-roles/service-roles.repository";
import { CandidatesRepository } from "../scheduling/candidates.repository";

export interface AssistantResponse {
  answer: string;
  matchedIntent: string;
  data: unknown;
}

function names(list: Array<{ firstName: string; lastName: string }>): string {
  return list.map((v) => `${v.firstName} ${v.lastName}`).join(", ");
}

@Injectable()
export class AssistantService {
  constructor(
    private readonly classifier: IntentClassifierService,
    private readonly queries: AssistantQueriesRepository,
    private readonly services: ServicesRepository,
    private readonly serviceRoles: ServiceRolesRepository,
    private readonly candidates: CandidatesRepository,
  ) {}

  async answer(churchId: string, question: string): Promise<AssistantResponse> {
    const intent = this.classifier.classify(question);

    switch (intent.type) {
      case "WHO_HASNT_SERVED": {
        const volunteers = await this.queries.whoHasntServed(churchId, intent.weeks);
        const answer =
          volunteers.length === 0
            ? `Everyone has served in the last ${intent.weeks} weeks.`
            : `${volunteers.length} volunteer(s) haven't served in the last ${intent.weeks} weeks: ${names(volunteers)}.`;
        return { answer, matchedIntent: intent.type, data: volunteers };
      }

      case "WHO_CAN_REPLACE": {
        const target = await this.queries.findVolunteerByName(churchId, intent.name);
        if (!target) {
          return { answer: `I couldn't find a volunteer matching "${intent.name}".`, matchedIntent: intent.type, data: null };
        }
        const replacements = await this.queries.whoCanReplace(churchId, target.volunteerProfileId);
        const answer =
          replacements.length === 0
            ? `No one else currently has ${target.firstName}'s skills at the same level.`
            : `${replacements.length} volunteer(s) could replace ${target.firstName} ${target.lastName}: ${names(replacements)}.`;
        return { answer, matchedIntent: intent.type, data: { target, replacements } };
      }

      case "WHO_NEEDS_TRAINING": {
        const volunteers = await this.queries.whoNeedsTraining(churchId);
        const answer =
          volunteers.length === 0
            ? "Every active volunteer has at least one completed training record."
            : `${volunteers.length} volunteer(s) have no completed training on file: ${names(volunteers)}.`;
        return { answer, matchedIntent: intent.type, data: volunteers };
      }

      case "PREDICT_SHORTAGES": {
        const from = new Date().toISOString();
        const to = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
        const upcoming = await this.services.listForChurch(churchId, from, to);

        const gaps: Array<{ serviceTitle: string; date: string; roleName: string; eligibleCount: number; minRequired: number }> = [];
        for (const service of upcoming) {
          const roles = await this.serviceRoles.listForService(churchId, service.id);
          for (const role of roles) {
            const eligible = await this.candidates.resolveCandidates(churchId, role.id, []);
            if (eligible.length < role.minRequired) {
              gaps.push({ serviceTitle: service.title, date: service.date, roleName: role.name, eligibleCount: eligible.length, minRequired: role.minRequired });
            }
          }
        }

        const answer =
          gaps.length === 0
            ? "No predicted coverage shortages in the next 4 weeks."
            : `${gaps.length} likely shortage(s) in the next 4 weeks: ${gaps
                .map((g) => `${g.roleName} on ${new Date(g.date).toLocaleDateString()} (${g.eligibleCount}/${g.minRequired} eligible)`)
                .join("; ")}.`;
        return { answer, matchedIntent: intent.type, data: gaps };
      }

      default:
        return {
          answer:
            "I can currently answer: who hasn't served recently, who can replace <name>, which volunteers need training, and predict coverage shortages.",
          matchedIntent: "UNKNOWN",
          data: null,
        };
    }
  }
}
