# ER Diagram — Educational Gaming Platform

This file contains a Mermaid ER diagram representing the core schema for the educational gaming platform (students up to Class 8).

Refer to the Prisma schema at [prisma/schema.prisma](prisma/schema.prisma).

```mermaid
erDiagram
    USER {
        UUID id PK
        TEXT role
        TEXT firstName
        TEXT lastName
        TEXT email UNIQUE
        INT grade
        TIMESTAMP createdAt
    }

    PARENT_STUDENT {
        UUID id PK
        UUID parentId FK
        UUID studentId FK
        TIMESTAMP createdAt
    }

    SUBJECT {
        UUID id PK
        TEXT name
        INT grade
        TEXT description
        TIMESTAMP createdAt
    }

    CHAPTER {
        UUID id PK
        UUID subjectId FK
        TEXT title
        INT order
        TIMESTAMP createdAt
    }

    QUESTION {
        UUID id PK
        UUID chapterId FK
        TEXT text
        TEXT type
        INT difficulty
        JSON options
        JSON answer
        TIMESTAMP createdAt
    }

    GAME {
        UUID id PK
        TEXT name
        UUID subjectId FK
        TEXT gameType
        INT grade
        JSON config
        TIMESTAMP createdAt
    }

    ACCOUNT {
        INT id PK
        UUID userId FK
        TEXT provider
        TEXT providerAccountId
        TEXT type
        TEXT access_token
        TEXT refresh_token
        INT expires_at
        TEXT id_token
    }

    SESSION {
        UUID id PK
        TEXT sessionToken UNIQUE
        UUID userId FK
        TIMESTAMP expires
    }

    VERIFICATION_TOKEN {
        TEXT identifier
        TEXT token UNIQUE
        TIMESTAMP expires
    }

    GAME_QUESTION {
        UUID id PK
        UUID gameId FK
        UUID questionId FK
        INT order
    }

    PROGRESS {
        UUID id PK
        UUID studentId FK
        UUID subjectId FK
        UUID chapterId FK
        UUID questionId FK
        UUID gameId FK
        FLOAT score
        INT attempts
        TEXT status
        TIMESTAMP completedAt
        JSON meta
        TIMESTAMP createdAt
    }

    ACHIEVEMENT {
        UUID id PK
        TEXT name UNIQUE
        TEXT description
        JSON criteria
        INT points
        TIMESTAMP createdAt
    }

    USER_ACHIEVEMENT {
        UUID id PK
        UUID userId FK
        UUID achievementId FK
        TIMESTAMP unlockedAt
        JSON progress
        TIMESTAMP createdAt
    }

    %% Relationships
    USER ||--o{ PARENT_STUDENT : "parent"
    USER ||--o{ PARENT_STUDENT : "student"

    SUBJECT ||--o{ CHAPTER : "has"
    CHAPTER ||--o{ QUESTION : "contains"

    GAME ||--o{ GAME_QUESTION : "includes"
    QUESTION ||--o{ GAME_QUESTION : "used_in"

    USER ||--o{ PROGRESS : "records"
    SUBJECT ||--o{ GAME : "maps_to"
    USER ||--o{ USER_ACHIEVEMENT : "earns"
    ACHIEVEMENT ||--o{ USER_ACHIEVEMENT : "awarded"

    USER ||--o{ ACCOUNT : "has"
    USER ||--o{ SESSION : "has"

    %% Optional relationships for analytics
    PROGRESS }o--|| QUESTION : "related_to"
    PROGRESS }o--|| CHAPTER : "related_to"
    PROGRESS }o--|| GAME : "related_to"
```

Notes:

- Primary keys are `UUID` for global uniqueness and easy sharding later.
- Many-to-many linking tables: `PARENT_STUDENT`, `GAME_QUESTION`, `USER_ACHIEVEMENT`.
- Use JSON/JSONB for flexible fields (`options`, `answer`, `config`, `criteria`, `meta`).

Next steps: export this Mermaid diagram to PNG/SVG for documentation or embed it into the README.
