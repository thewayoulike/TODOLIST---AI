import { User } from "../types";

const getRelativeDate = (daysSubtract: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysSubtract);
  return date.toISOString().split('T')[0];
};

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Alex Johnson',
    email: 'alex.j@company.com',
    avatarColor: 'bg-indigo-600',
    type: 'Work'
  },
  {
    id: 'u2',
    name: 'Alex Johnson',
    email: 'alex.johnson99@gmail.com',
    avatarColor: 'bg-emerald-600',
    type: 'Personal'
  }
];

export const MOCK_EMAILS = `
Subject: Project Alpha Launch Date
From: Sarah Jenkins (sarah.j@company.com)
Date: ${getRelativeDate(1)}
Hi team, we need to finalize the landing page copy by this Friday. Please review the attached draft and send me your feedback. Also, remember to schedule the deployment call with DevOps for next Tuesday.

Subject: Q3 Financial Report
From: Finance Team (finance@company.com)
Date: ${getRelativeDate(2)}
Please submit your department's expense reports for Q3 by end of day tomorrow. It's critical for the board meeting preparation.

Subject: Team Lunch?
From: Mike Ross
Date: ${getRelativeDate(0)}
Hey, anyone up for tacos today? No work talk, just tacos.
`;

export const MOCK_CHATS = `
[Google Chat - #engineering]
Alex: Hey, I noticed a bug in the login flow. Can someone take a look?
You: I'll check it out after lunch.
Alex: Thanks. Also, don't forget we need to update the API documentation before the sprint ends.

[Google Chat - #marketing]
Jessica: Did you get a chance to look at the new logo variants?
You: Not yet, I will review them tomorrow morning first thing.
Jessica: Perfect. We need a decision by Wednesday to hit the print deadline.
`;