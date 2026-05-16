import { Schema } from "mongoose";

const meetingSchema = new Schema({
  meetingId: {type:String},
  meetingcode:{type:String},
  date:{type:Date, default:Date.now},
})

export default meetingSchema;