import { Batch } from "models/batch";
import { Branch } from "models/branch";
import { Role } from "models/commonModels";
import { Organization } from "models/organization";
import { User } from "models/user";
import { COLLECTION } from "../constants";
import { getDb } from "../db";
import logger from "../logger";
import branchService from "./branchService";
import { commonBaseModelOps } from "./commonDbService";
import organizationService from "./organizationService";
import userService from "./userService";
import courseService from "./courseService";
import emailService from "./emailService";
import permissionService from "./permissionService";
import nodemailer from "nodemailer";

const db = getDb();
const baseModelOps = commonBaseModelOps<Batch>(COLLECTION.BATCH);
const orgModelOps = organizationService.commonOrgModelOps<Batch>(
  COLLECTION.BATCH
);
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "Divya@bytexl.in",
    pass: "DivyaB@123",
  },
  secure: true, // use SSL
  port: 587 // port for SSL
});


async function addUserDetails(
  _id: string,
  sendEmailNotification: boolean,
  emailArray: string[]
): Promise<boolean> {
  // const batchService: batchService | null = await baseModelOps.findById(_id);
  // if (!batchService) {
  //   return false;
  // }

  if (sendEmailNotification) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "Divya@bytexl.in",
        pass: "DivyaB@123",
      },
    });

    //

    await transporter.sendMail({
      from: "Divya@bytexl.in",
      to: emailArray,
      subject: `[byteXL] Wohooo!! Congratulations You successfully earned a new Certification`,
      html: `<!DOCTYPE html>
      <html lang="en">
      
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Get Your Certification for ByteXL Course</title>
          <link rel="favicon" href="favicon.ico">
          <style>
          :root {
            --dark-color: #212121;
          }
          
          body {
            font-family: system-ui;
            text-align: center;
            margin-top: 40px;
            font-size: 1.5em;
          }
          
          h4 {
            font-weight: normal;
            margin-bottom: 5px;
          }
          h1 {
            font-weight: normal;
            margin-top: 0;
            margin-bottom: 40px;
            font-size: 2em;
          }
          
          img {
            border-radius: 150%;
            height: 120px;
          }
          
          main {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          main * {
            margin-bottom: 12px;
          }
          
          input {
            text-align: center;
            font-size: large;
            outline: none;
            border: none;
            border-bottom: 1px solid black;
            text-transform: capitalize;
          }
          
          /* for styling the autocomplete style */
          input:-webkit-autofill,
          input:-webkit-autofill:hover,
          input:-webkit-autofill:focus,
          input:-webkit-autofill:active {
            transition: background-color 5000s ease-in-out 0s;
            -webkit-text-fill-color: var(--dark-color) !important;
          }
          
          button {
            background: #8bc34a;
            color: #fff;
            border: none;
            font-size: 0.8em;
            padding: 5px 15px;
            margin: 20px;
            border-radius: 5px;
            cursor: pointer;
          }
          a {
            color: #6492f6;
          }
          
          /* dark mode css */
          @media (prefers-color-scheme: dark) {
            body {
              background: var(--dark-color);
              color: #fff;
            }
            input,
            input:active {
              background: var(--dark-color);
              border-color: #fff;
              color: #fff;
            }
          
            /* for styling the autocomplete style */
            input:-webkit-autofill,
            input:-webkit-autofill:hover,
            input:-webkit-autofill:focus,
            input:-webkit-autofill:active {
              transition: background-color 5000s ease-in-out 0s;
              -webkit-text-fill-color: #fff !important;
            }
          }          
          </style>
      </head>
      
      <body>
          <header>
              <img src="https://uploads-ssl.webflow.com/60d45974277c668d0adff732/6172846901fb514dbd27161d_Bytexl%20logo.png" alt="ByteXL India Logo">
              <h4>Get your certificate of Completion for </h4>
              <h1> <a>Python Programming</a></h1>
          </header>
          <main>
      
              <label for="name">Type Your Name</label>
              <input required type="text" name="Name" autocomplete="name" placeholder="Type Your Name" id="name" minlength="3"
                  maxlength="50">
              <Button id="submitBtn">Get Certificate</Button>
      
      
          </main>
          <script src="https://unpkg.com/pdf-lib@1.4.0"></script>
          <script src="./FileSaver.js"></script>
          <script src="https://unpkg.com/@pdf-lib/fontkit@0.0.4"></script>
          <script src="./index.js"></script>
      </body>
      
      </html>
      `,
    });
  }

  return true;
}

async function upsert(
  objToUpsert: Partial<Batch>,
  currUser: User
): Promise<Batch | null> {
  if (!objToUpsert._id) {
    objToUpsert.visibility = "private";
    objToUpsert.createdBy = {
      _id: currUser._id,
    };
    if (!objToUpsert.users?.admins) {
      objToUpsert.users = { admins: [currUser._id] };
    }
  }
  let obj: Batch | null = await baseModelOps.upsert(objToUpsert);
  if (obj) {
    if (!currUser.batches || !currUser.batches.includes(obj._id)) {
      userService.updateUserRoles(
        "batches",
        obj._id,
        [currUser._id],
        ["admin"]
      );
    }
  }
  return obj;
}

async function getUserBatches(
  userId: string,
  fillBranchOrgDetails: boolean = false
): Promise<Batch[] | null> {
  const userObj: User = (await db
    .collection<User>(COLLECTION.USERS)
    .findOne({ _id: userId })) as User;
  const batchIds = userObj?.batches || [];
  let batches: Batch[] = [];

  if (await permissionService.isSuperAdmin(userId)) {
    batches = await db
      .collection<Batch>(COLLECTION.BATCH)
      .find({})
      .sort({ created: -1 })
      .toArray();
  } else {
    batches = await db
      .collection<Batch>(COLLECTION.BATCH)
      .find({ _id: { $in: batchIds } })
      .sort({ created: -1 })
      .toArray();
  }
  const orgIdsVsOrg: { [key: string]: Organization } = {};
  const branchIdsVsBranch: { [key: string]: Branch } = {};
  //TODO: optimize: read orgs, branches in single query using $in: []
  if (batches && fillBranchOrgDetails) {
    for (var batch of batches) {
      if (!orgIdsVsOrg[batch.organization?._id]) {
        const org: Organization = (await organizationService.findById(
          batch.organization._id
        )) as Organization;
        orgIdsVsOrg[org._id] = org;
        batch.organization.title = org?.title;
      } else {
        batch.organization.title = orgIdsVsOrg[batch.organization._id].title;
      }
      if (!branchIdsVsBranch[batch.branch?._id]) {
        const branch: Branch = (await branchService.findById(
          batch.branch._id
        )) as Branch;
        branchIdsVsBranch[branch._id] = branch;
        batch.branch.title = branch.title;
      } else {
        batch.branch.title = branchIdsVsBranch[batch.branch._id].title;
      }
    }
  }
  return batches;
}

async function removeUsers(_id: string, userIds: string[]): Promise<boolean> {
  return userService.removeGroupIdsFromUser("batches", userIds, [_id]);
}

async function removeById(objId: string): Promise<any> {
  //1. remove this batchId from users
  const users: User[] = await userService.findUsersByGroup("batches", [objId]);
  await removeUsers(
    objId,
    users.map((user) => user._id)
  );
  //2. delete courses
  courseService.removeByBatchIds([objId]);
  //3. delete batch
  return baseModelOps.removeById(objId);
}

async function addUsers(
  _id: string,
  emailList: string[],
  roles: Role[],
  sendEmailNotification: boolean
): Promise<boolean> {
  const batch: Batch | null = await baseModelOps.findById(_id);
  if (!batch || emailList?.length == 0) {
    return false;
  }

  const userIds = [];
  var usersToAdd: User[] | null = await userService.find({
    email: { $in: emailList },
    branches: batch.branch._id,
  });
  if (!usersToAdd || usersToAdd.length == 0) {
    logger.info(`No matching found for brancId: ${batch.branch._id}`);
    return false;
  }

  await userService.updateUserRoles(
    "batches",
    _id,
    usersToAdd.map((user) => user._id),
    roles
  );

  //TODO: send email at once with BCC?
  if (sendEmailNotification) {
    for (const user of usersToAdd) {
      await emailService.send({
        subject: `[byteXL] You have been added to new batch`,
        html: `<p>You have been added to batch: ${batch.title}</p>
        <br/>
        `,
        toEmails: [user.email],
      });
    }
  }
  

  return true;
}

export default {
  ...baseModelOps,
  ...orgModelOps,
  upsert: upsert,
  getUserBatches: getUserBatches,
  addUsers: addUsers,
  removeUsers: removeUsers,
  removeById: removeById,
  addUserDetails: addUserDetails,
};
