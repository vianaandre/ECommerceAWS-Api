import { SNSEvent, Context } from "aws-lambda";

export async function handler(event: SNSEvent, content: Context): Promise<void> {
    event.Records.forEach((record) => {
        console.log(record.Sns)
    })    

    return
}