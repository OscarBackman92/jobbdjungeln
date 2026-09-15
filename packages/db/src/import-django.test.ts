import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyImport,
  assertReadOnlySql,
  type DjangoDump,
  isoDate,
  mapJobProfiles,
  planImport,
  reportedInPatches,
} from './import-django.ts';
import * as t from './schema.ts';
import { createTestDatabase, type TestDatabase } from './testing.ts';

function ids() {
  let n = 0;
  return {
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  };
}

function emptyDump(): DjangoDump {
  return {
    users: [],
    emails: [],
    profiles: [],
    applications: [],
    events: [],
    searches: [],
    resumes: [],
    periods: [],
    activities: [],
  };
}

describe('assertReadOnlySql', () => {
  it('allows a select', () => {
    expect(() => assertReadOnlySql('select id from auth_user')).not.toThrow();
  });

  it('rejects writes', () => {
    expect(() => assertReadOnlySql('insert into auth_user (id) values (1)')).toThrow(/SELECT/);
    expect(() => assertReadOnlySql('select id from auth_user; delete from auth_user')).toThrow(
      /skrivningar/,
    );
  });
});

describe('isoDate', () => {
  it('keeps a date string without shifting it', () => {
    expect(isoDate('2024-03-31')).toBe('2024-03-31');
    expect(isoDate('2024-03-31T22:00:00.000Z')).toBe('2024-03-31');
  });
});

describe('mapJobProfiles', () => {
  it('turns evidence into skills and confirmed terms', () => {
    const profiles = mapJobProfiles(
      [
        {
          id: 'p1',
          label: 'Ekonomi',
          evidence: [
            { term: 'Excel', confirmed: true },
            { term: 'Python', confirmed: false },
          ],
        },
      ],
      {},
      'Ekonomiassistent',
      () => 'new',
    );
    expect(profiles).toEqual([
      { id: 'p1', label: 'Ekonomi', skills: ['Excel', 'Python'], confirmed: ['Excel'] },
    ]);
  });

  it('builds one profile from skill_groups when job_profiles is empty', () => {
    const profiles = mapJobProfiles(
      [],
      { technical: ['SQL'], domain: ['Bokslut'], languages: [] },
      'Ekonom',
      () => 'from-groups',
    );
    expect(profiles).toEqual([
      {
        id: 'from-groups',
        label: 'Ekonom',
        skills: ['SQL', 'Bokslut'],
        confirmed: ['SQL', 'Bokslut'],
      },
    ]);
  });
});

describe('planImport', () => {
  it('maps a user, application, event and CV, skipping inactive accounts', () => {
    const dump: DjangoDump = {
      ...emptyDump(),
      users: [
        {
          id: 1,
          email: 'Anna@Example.test',
          firstName: 'Anna',
          lastName: 'Svensson',
          isActive: true,
          dateJoined: new Date('2024-01-02T10:00:00Z'),
          lastLogin: new Date('2024-06-01T10:00:00Z'),
        },
        {
          id: 2,
          email: 'gone@example.test',
          firstName: 'Gone',
          lastName: '',
          isActive: false,
          dateJoined: new Date('2024-01-01T00:00:00Z'),
          lastLogin: null,
        },
      ],
      emails: [{ userId: 1, email: 'anna@example.test', verified: true, primary: true }],
      profiles: [
        {
          userId: 1,
          operatorId: 'ANS-AB12CD',
          deletionWarnedAt: null,
          weeklySummarySentAt: null,
        },
      ],
      applications: [
        {
          id: 10,
          ownerId: 1,
          company: 'Acme AB',
          title: 'Ekonomiassistent',
          location: 'Stockholm',
          adUrl: 'http://arbetsformedlingen.se/platsannonser/123?utm_source=x',
          applyUrl: '',
          adDescription: 'Vi söker dig som kan Excel.',
          sourceJobId: '123',
          source: 'platsbanken',
          status: 'interview',
          outcome: '',
          intent: 'active',
          applyBy: '2024-02-01',
          applyByIsAuto: true,
          appliedAt: '2024-01-15',
          deadline: '2024-02-01',
          nextActionAt: null,
          closedAt: null,
          archivedAt: null,
          salaryClaim: '32 000',
          contactName: '',
          contactInfo: '',
          notes: '',
          occupationConceptId: '',
          occupationLabel: '',
          occupationGroupLabel: '',
          workingHoursType: '',
          scopeOfWorkMin: null,
          scopeOfWorkMax: null,
          matchScore: 72,
          matchSnapshot: { score: 72, gaps: [{ term: 'SQL' }] },
          matchVersion: 2,
          matchScoredAt: new Date('2024-01-15T12:00:00Z'),
          matchProfileId: 'p1',
          reportExcluded: false,
          reportNote: '',
          reportedInId: 5,
          createdAt: new Date('2024-01-10T00:00:00Z'),
          updatedAt: new Date('2024-01-20T00:00:00Z'),
        },
      ],
      events: [
        {
          id: 20,
          applicationId: 10,
          occurredAt: '2024-01-20',
          note: 'Kallad till intervju',
          status: 'interview',
          eventType: 'status',
          fromStage: 'sokt',
          toStage: 'intervju',
          isReportable: true,
          reportExcluded: false,
          reportedInId: 5,
          createdAt: new Date('2024-01-20T00:00:00Z'),
        },
        {
          id: 21,
          applicationId: 10,
          occurredAt: '2024-01-15',
          note: 'Sökt',
          status: '',
          eventType: 'status',
          fromStage: '',
          toStage: '',
          isReportable: false,
          reportExcluded: false,
          reportedInId: null,
          createdAt: new Date('2024-01-15T00:00:00Z'),
        },
      ],
      searches: [
        {
          id: 3,
          ownerId: 1,
          label: 'Ekonomi',
          query: 'ekonomiassistent',
          regions: ['1'],
          municipalities: [],
          occupationFields: [],
          occupationGroups: [],
          remote: false,
          matchCv: true,
          digestCheckedAt: null,
          createdAt: new Date('2024-01-03T00:00:00Z'),
        },
      ],
      resumes: [
        {
          userId: 1,
          headline: 'Ekonom',
          summary: 'Bokslut och lön',
          skills: ['Excel'],
          skillGroups: { technical: ['SQL'] },
          experience: [
            {
              title: 'Ekonomiassistent',
              company: 'Acme',
              years: '2020-2023',
              description: 'Bokslut',
            },
          ],
          education: [{ degree: 'Ekonomi', school: 'Handels', years: '2017-2020' }],
          jobProfiles: [
            {
              id: 'p1',
              label: 'Ekonomi',
              evidence: [{ term: 'Excel', confirmed: true }],
            },
          ],
          updatedAt: new Date('2024-01-04T00:00:00Z'),
        },
      ],
      periods: [
        {
          id: 5,
          userId: 1,
          year: 2024,
          month: 1,
          submittedAt: null,
          note: '',
          createdAt: new Date('2024-02-01T00:00:00Z'),
        },
      ],
      activities: [
        {
          id: 7,
          userId: 1,
          type: 'kurs',
          occurredOn: '2024-01-12',
          title: 'Excelkurs',
          organisation: 'AF',
          note: '',
          jobId: 10,
          reportExcluded: false,
          reportNote: '',
          reportedInId: 5,
        },
      ],
    };

    const planned = planImport(dump, ids());
    expect(planned.report.errors).toEqual([]);
    expect(planned.report.counts.skippedInactiveUsers).toBe(1);
    expect(planned.users).toHaveLength(1);
    expect(planned.users[0]).toMatchObject({
      email: 'anna@example.test',
      name: 'Anna Svensson',
      operatorId: 'ANS-AB12CD',
      weeklySummaryOptIn: false,
      reminderOptIn: true,
      emailVerified: true,
    });
    expect(planned.accounts[0]?.password).toBeNull();
    expect(planned.accounts[0]?.providerId).toBe('credential');

    expect(planned.applications).toHaveLength(1);
    const application = planned.applications[0];
    expect(application?.adUrlKey).toBe('https://arbetsformedlingen.se/platsannonser/123');
    expect(application?.employerKey).toBe('acme');
    expect(application?.furthestStage).toBe('intervju');
    expect(application?.lastActivityAt).toBe('2024-01-20');
    expect(application?.matchSnapshot).toMatchObject({
      score: 72,
      matchProfileId: 'p1',
    });

    expect(planned.events).toHaveLength(2);
    expect(planned.events.every((event) => event.origin === 'import')).toBe(true);
    expect(planned.events.find((event) => event.note === 'Sökt')?.status).toBeNull();

    expect(planned.resumes[0]?.jobProfiles[0]).toMatchObject({
      label: 'Ekonomi',
      skills: ['Excel'],
      confirmed: ['Excel'],
    });
    expect(planned.resumes[0]?.experience[0]).toMatchObject({
      role: 'Ekonomiassistent',
      employer: 'Acme',
      start: '2020',
      end: '2023',
    });
    expect(planned.searches[0]?.query).toBe('ekonomiassistent');
    expect(planned.searches[0]?.digestOptIn).toBe(true);

    const patches = reportedInPatches(planned);
    expect(patches.applications).toHaveLength(1);
    expect(patches.events).toHaveLength(1);
    expect(patches.activities).toHaveLength(1);
  });

  it('aborts the report on colliding emails and invalid statuses', () => {
    const dump: DjangoDump = {
      ...emptyDump(),
      users: [
        {
          id: 1,
          email: 'a@example.test',
          firstName: 'A',
          lastName: '',
          isActive: true,
          dateJoined: null,
          lastLogin: null,
        },
        {
          id: 2,
          email: 'A@example.test',
          firstName: 'B',
          lastName: '',
          isActive: true,
          dateJoined: null,
          lastLogin: null,
        },
      ],
      applications: [
        {
          id: 9,
          ownerId: 1,
          company: 'Acme',
          title: 'Roll',
          location: '',
          adUrl: '',
          applyUrl: '',
          adDescription: '',
          sourceJobId: '',
          source: '',
          status: 'hittepå',
          outcome: '',
          intent: 'active',
          applyBy: null,
          applyByIsAuto: true,
          appliedAt: '2024-01-01',
          deadline: null,
          nextActionAt: null,
          closedAt: null,
          archivedAt: null,
          salaryClaim: '',
          contactName: '',
          contactInfo: '',
          notes: '',
          occupationConceptId: '',
          occupationLabel: '',
          occupationGroupLabel: '',
          workingHoursType: '',
          scopeOfWorkMin: null,
          scopeOfWorkMax: null,
          matchScore: null,
          matchSnapshot: {},
          matchVersion: 0,
          matchScoredAt: null,
          matchProfileId: '',
          reportExcluded: false,
          reportNote: '',
          reportedInId: null,
          createdAt: null,
          updatedAt: null,
        },
      ],
    };
    const planned = planImport(dump, ids());
    expect(planned.report.errors.some((error) => error.includes('e-postkollision'))).toBe(true);
    expect(planned.report.errors.some((error) => error.includes('ogiltig status'))).toBe(true);
  });
});

describe('applyImport', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.$close();
  });

  it('writes mapped rows into the new schema and patches reported_in', async () => {
    const dump: DjangoDump = {
      ...emptyDump(),
      users: [
        {
          id: 1,
          email: 'import@example.test',
          firstName: 'Import',
          lastName: 'Test',
          isActive: true,
          dateJoined: new Date('2024-01-01T00:00:00Z'),
          lastLogin: null,
        },
      ],
      emails: [{ userId: 1, email: 'import@example.test', verified: true, primary: true }],
      profiles: [
        {
          userId: 1,
          operatorId: 'ANS-ZZ9Y8X',
          deletionWarnedAt: null,
          weeklySummarySentAt: null,
        },
      ],
      applications: [
        {
          id: 10,
          ownerId: 1,
          company: 'Acme AB',
          title: 'Ekonomiassistent',
          location: '',
          adUrl: 'https://example.test/job/1',
          applyUrl: '',
          adDescription: '',
          sourceJobId: '1',
          source: 'platsbanken',
          status: 'applied',
          outcome: '',
          intent: 'active',
          applyBy: null,
          applyByIsAuto: true,
          appliedAt: '2024-01-15',
          deadline: null,
          nextActionAt: null,
          closedAt: null,
          archivedAt: null,
          salaryClaim: '',
          contactName: '',
          contactInfo: '',
          notes: '',
          occupationConceptId: '',
          occupationLabel: '',
          occupationGroupLabel: '',
          workingHoursType: '',
          scopeOfWorkMin: null,
          scopeOfWorkMax: null,
          matchScore: 40,
          matchSnapshot: { score: 40 },
          matchVersion: 2,
          matchScoredAt: null,
          matchProfileId: '',
          reportExcluded: false,
          reportNote: '',
          reportedInId: 5,
          createdAt: new Date('2024-01-15T00:00:00Z'),
          updatedAt: new Date('2024-01-15T00:00:00Z'),
        },
      ],
      events: [
        {
          id: 20,
          applicationId: 10,
          occurredAt: '2024-01-15',
          note: 'Sökt',
          status: 'applied',
          eventType: 'status',
          fromStage: '',
          toStage: 'sokt',
          isReportable: false,
          reportExcluded: false,
          reportedInId: 5,
          createdAt: new Date('2024-01-15T00:00:00Z'),
        },
      ],
      periods: [
        {
          id: 5,
          userId: 1,
          year: 2024,
          month: 1,
          submittedAt: null,
          note: '',
          createdAt: new Date('2024-02-01T00:00:00Z'),
        },
      ],
      activities: [
        {
          id: 7,
          userId: 1,
          type: 'kurs',
          occurredOn: '2024-01-12',
          title: 'Excelkurs',
          organisation: '',
          note: '',
          jobId: 10,
          reportExcluded: false,
          reportNote: '',
          reportedInId: 5,
        },
      ],
    };

    const planned = planImport(dump, ids());
    await applyImport(db, planned);

    const [user] = await db.select().from(t.users);
    expect(user?.email).toBe('import@example.test');
    expect(user?.weeklySummaryOptIn).toBe(false);
    expect(user?.operatorId).toBe('ANS-ZZ9Y8X');

    const [account] = await db.select().from(t.accounts);
    expect(account?.password).toBeNull();

    const [application] = await db.select().from(t.applications);
    const [period] = await db.select().from(t.reportPeriods);
    expect(application?.reportedInId).toBe(period?.id);
    expect(application?.furthestStage).toBe('sokt');
    expect(application?.matchScore).toBe(40);

    const [event] = await db.select().from(t.applicationEvents);
    expect(event?.origin).toBe('import');
    expect(event?.reportedInId).toBe(period?.id);

    const [activity] = await db.select().from(t.activities);
    expect(activity?.applicationId).toBe(application?.id);
    expect(activity?.reportedInId).toBe(period?.id);

    const [same] = await db
      .select()
      .from(t.users)
      .where(eq(t.users.email, 'import@example.test'));
    expect(same?.id).toBe(user?.id);
  });
});
