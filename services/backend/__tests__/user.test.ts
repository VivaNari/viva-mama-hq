// import { createUser } from "../controllers/user.controller.js";
// import User from "../models/user.js";

// // 1️⃣ Replace the actual User model with a fake one.
// jest.mock("../models/user.js");

// // 2️⃣ Group our tests
// describe("createUser", () => {
//     // 3️⃣ Create fake request and response objects (like Express gives)
//     const mockRequest = (body) => ({ body });
//     const mockResponse = () => {
//         const res = {};
//         res.status = jest.fn().mockReturnValue(res);
//         res.json = jest.fn().mockReturnValue(res);
//         return res;
//     };

//     test("should return 201 and created user", async () => {
//         // 4️⃣ Create fake Express objects
//         const req = mockRequest({ name: "Alice", email: "alice@example.com" });
//         const res = mockResponse();

//         // 5️⃣ Tell Jest what the fake User.create() should do
//         User.create.mockResolvedValue({ name: "Alice", email: "alice@example.com" });

//         // 6️⃣ Call the controller function (like Express would)
//         await createUser(req, res);

//         // 7️⃣ Check if it behaved correctly
//         expect(User.create).toHaveBeenCalledWith({ name: "Alice", email: "alice@example.com" });
//         expect(res.status).toHaveBeenCalledWith(201);
//         expect(res.json).toHaveBeenCalledWith({
//             success: true,
//             data: { name: "Alice", email: "alice@example.com" },
//         });
//     });
// });
