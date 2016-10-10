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
    };
  }

}

/**
 * Creates a new issue to track cases when a user requests for a counsellor
 * but none be found.
 * @param {string} userId userId
 * @return {Issue} an issue
 */
function newMissedUserIssue({ userId }) {
  return new Issue({
    issueId: uuid.v4(),
    userId,
    issueType: ISSUE_TYPE.USER_MISSED,
  });
}

/**
 * Creates a new issue to track cases when a user requests for a counsellor
 * and there was a match, a private room is created with them two.
 * @param {string} userId userId
 * @param {string} counsellorId counsellorId
 * @return {Issue} an issue
 */
function newUserRequestedIssue({ userId, counsellorId }) {
  return new Issue({
    issueId: uuid.v4(),
    userId,
    counsellorId,
    issueType: ISSUE_TYPE.USER_REQUESTED,
  });
}

export default Issue;
export {
  newMissedUserIssue,
  newUserRequestedIssue,
};
