import { pipe, subscribe } from "wonka";
import { getClient } from "common/messaging/graphql";
import { createRequest } from "urql";
import { DocumentNode } from "graphql";

export function sendQuery(query: DocumentNode, variables: object) {
  const client = getClient(undefined);

  return new Promise((resolve, reject) => {
    pipe(
      client.executeQuery(createRequest(query, variables)) as any,
      subscribe(({ data, error }: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      })
    );
  });
}

export function sendMutation<T>(query: DocumentNode, variables: object) {
  const client = getClient(undefined);

  return new Promise<T>((resolve, reject) => {
    pipe(
      client.executeMutation(createRequest(query, variables)) as any,
      subscribe(({ data, error }: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      })
    );
  });
}
