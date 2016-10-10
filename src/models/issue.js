import uuid from 'uuid';

import ISSUE_TYPE from './issue_type';

class Issue {
  issueId: string;
  userId: string;
  counsellorId: string;
  dateCreated: Date;
  issueType: number;

  constructor({
    issueId,
    userId,
    counsellorId,
    issueType,
  }) {
    this.issueId = issueId;
    this.userId = userId;
    this.counsellorId = counsellorId;
    this.dateCreated = new Date();
    this.issueType = issueType;
  }

  get toJson() {
    return {
      issueId: this.issueId,
      userId: this.userId,
      counsellorId: this.counsellorId,
      dateCreated: this.dateCreated,
      issueType: this.issueType,
    }
  }

}

function newMissedUserIssue({ userId }) {
  return new Issue({
      issueId: uuid.v4(),
      userId,
      issueType: ISSUE_TYPE.USER_MISSED,
  })
}

function newUserRequestedIssue({ userId, counsellorId }) {
  return new Issue({
    issueId: uuid.v4(),
    userId,
    counsellorId,
    issueType: ISSUE_TYPE.USER_REQUESTED,
  })
}

export default Issue
export {
  newMissedUserIssue,
  newUserRequestedIssue,
}
