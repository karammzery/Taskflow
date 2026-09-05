const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json());


// =====================================================
// DATABASE
// =====================================================

const db = new sqlite3.Database("./taskflow.db");

db.serialize(() => {

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            priority TEXT DEFAULT 'medium',
            category TEXT DEFAULT 'Personal',
            due_date TEXT,
            completed INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL
        )
    `);

});


// =====================================================
// HOME PAGE
// =====================================================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(__dirname, "index.html")
    );

});


// =====================================================
// SIGN UP
// =====================================================

app.post("/api/signup", async (req, res) => {

    try {

        const username = String(
            req.body.username || ""
        ).trim();

        const password = String(
            req.body.password || ""
        );


        if (username.length < 3) {

            return res.status(400).json({
                error: "Username must be at least 3 characters."
            });

        }


        if (password.length < 6) {

            return res.status(400).json({
                error: "Password must be at least 6 characters."
            });

        }


        db.get(
            `
            SELECT id
            FROM users
            WHERE username = ?
            `,
            [username],

            async (err, user) => {

                if (err) {

                    console.error(err);

                    return res.status(500).json({
                        error: "Server error."
                    });

                }


                if (user) {

                    return res.status(409).json({
                        error: "Username already exists."
                    });

                }


                try {

                    const hashedPassword =
                        await bcrypt.hash(
                            password,
                            10
                        );


                    db.run(
                        `
                        INSERT INTO users
                        (
                            username,
                            password
                        )
                        VALUES (?, ?)
                        `,
                        [
                            username,
                            hashedPassword
                        ],

                        function (err) {

                            if (err) {

                                console.error(err);

                                return res.status(500).json({
                                    error: "Could not create account."
                                });

                            }


                            res.json({
                                success: true,
                                message: "Account created successfully."
                            });

                        }
                    );


                } catch (error) {

                    console.error(error);

                    res.status(500).json({
                        error: "Server error."
                    });

                }

            }
        );


    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Server error."
        });

    }

});


// =====================================================
// LOGIN
// =====================================================

app.post("/api/login", async (req, res) => {

    try {

        const username = String(
            req.body.username || ""
        ).trim();

        const password = String(
            req.body.password || ""
        );


        if (!username || !password) {

            return res.status(400).json({
                error: "Username and password are required."
            });

        }


        db.get(
            `
            SELECT *
            FROM users
            WHERE username = ?
            `,
            [username],

            async (err, user) => {

                if (err) {

                    console.error(err);

                    return res.status(500).json({
                        error: "Server error."
                    });

                }


                if (!user) {

                    return res.status(401).json({
                        error: "Invalid username or password."
                    });

                }


                try {

                    const valid =
                        await bcrypt.compare(
                            password,
                            user.password
                        );


                    if (!valid) {

                        return res.status(401).json({
                            error: "Invalid username or password."
                        });

                    }


                    res.json({

                        success: true,

                        user: {

                            id: user.id,

                            username: user.username

                        }

                    });


                } catch (error) {

                    console.error(error);

                    res.status(500).json({
                        error: "Server error."
                    });

                }

            }
        );


    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Server error."
        });

    }

});


// =====================================================
// GET TASKS
// =====================================================

app.get("/api/tasks/:userId", (req, res) => {

    const userId =
        Number(req.params.userId);


    if (!userId) {

        return res.status(400).json({
            error: "Invalid user ID."
        });

    }


    db.all(
        `
        SELECT *
        FROM tasks
        WHERE user_id = ?
        ORDER BY
            completed ASC,
            created_at DESC
        `,
        [userId],

        (err, rows) => {

            if (err) {

                console.error(err);

                return res.status(500).json({
                    error: "Could not load tasks."
                });

            }


            res.json(rows);

        }
    );

});


// =====================================================
// ADD TASK
// =====================================================

app.post("/api/tasks", (req, res) => {

    const userId =
        Number(req.body.userId);

    const text =
        String(
            req.body.text || ""
        ).trim();

    const priority =
        String(
            req.body.priority || "medium"
        );

    const category =
        String(
            req.body.category || "Personal"
        );

    const dueDate =
        String(
            req.body.dueDate || ""
        );


    if (!userId) {

        return res.status(400).json({
            error: "Invalid user."
        });

    }


    if (!text) {

        return res.status(400).json({
            error: "Task text is required."
        });

    }


    const validPriorities = [
        "low",
        "medium",
        "high"
    ];


    if (
        !validPriorities.includes(
            priority
        )
    ) {

        return res.status(400).json({
            error: "Invalid priority."
        });

    }


    db.run(
        `
        INSERT INTO tasks
        (
            user_id,
            text,
            priority,
            category,
            due_date,
            completed,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, 0, ?)
        `,
        [
            userId,
            text,
            priority,
            category,
            dueDate,
            Date.now()
        ],

        function (err) {

            if (err) {

                console.error(err);

                return res.status(500).json({
                    error: "Could not create task."
                });

            }


            res.json({

                success: true,

                id: this.lastID

            });

        }
    );

});


// =====================================================
// UPDATE TASK
// =====================================================

app.put("/api/tasks/:taskId", (req, res) => {

    const taskId =
        Number(req.params.taskId);

    const userId =
        Number(req.body.userId);


    if (!taskId || !userId) {

        return res.status(400).json({
            error: "Invalid request."
        });

    }


    if (
        req.body.completed === undefined
    ) {

        return res.status(400).json({
            error: "Nothing to update."
        });

    }


    const completed =
        Number(req.body.completed)
            ? 1
            : 0;


    db.run(
        `
        UPDATE tasks
        SET completed = ?
        WHERE
            id = ?
            AND user_id = ?
        `,
        [
            completed,
            taskId,
            userId
        ],

        function (err) {

            if (err) {

                console.error(err);

                return res.status(500).json({
                    error: "Could not update task."
                });

            }


            if (
                this.changes === 0
            ) {

                return res.status(404).json({
                    error: "Task not found."
                });

            }


            res.json({
                success: true
            });

        }
    );

});


// =====================================================
// DELETE TASK
// =====================================================

app.delete("/api/tasks/:taskId", (req, res) => {

    const taskId =
        Number(req.params.taskId);

    const userId =
        Number(req.query.userId);


    if (!taskId || !userId) {

        return res.status(400).json({
            error: "Invalid request."
        });

    }


    db.run(
        `
        DELETE FROM tasks
        WHERE
            id = ?
            AND user_id = ?
        `,
        [
            taskId,
            userId
        ],

        function (err) {

            if (err) {

                console.error(err);

                return res.status(500).json({
                    error: "Could not delete task."
                });

            }


            if (
                this.changes === 0
            ) {

                return res.status(404).json({
                    error: "Task not found."
                });

            }


            res.json({
                success: true
            });

        }
    );

});


// =====================================================
// START SERVER
// =====================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log("");
        console.log("=================================");
        console.log("       TASKFLOW SERVER");
        console.log("=================================");
        console.log("");
        console.log(
            "Open: http://localhost:" + PORT
        );
        console.log("");
        console.log(
            "Database: taskflow.db"
        );
        console.log("");
        console.log("=================================");

    }
);