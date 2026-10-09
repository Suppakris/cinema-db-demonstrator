-- ============================================================================
-- PROJECT: MAJOR CINEPLEX ENTERPRISE WEB BOOKING SYSTEM SCHEMA
-- ARCHITECTURE: Relational Database Model (RDBMS) targeting 3NF / BCNF
-- PLATFORM TARGET: Web Guest Checkout Engine (High-Concurrency Architecture)
-- RDBMS TARGET: MySQL 8.0.16+ / InnoDB Storage Engine (Strict ACID Compliant)
-- CHARACTER SET: utf8mb4 | COLLATION: utf8mb4_unicode_ci (Full Unicode Support)
-- SCOPE METRICS: 27 Physical Relational Tables | 4 Real-Time Analytical Views
-- ============================================================================

-- ============================================================================
-- SECTION 1: SPATIAL HIERARCHY, THEATER TOPOLOGY & SEATING MATRIX
-- Normalized territorial infrastructure avoiding update/deletion anomalies.
-- ============================================================================

-- [Entity 1: Province] Administrative boundary definition
CREATE TABLE Province (
    Province_ID INT NOT NULL AUTO_INCREMENT,
    Province_Name VARCHAR(100) NOT NULL,
    CONSTRAINT PK_Province PRIMARY KEY (Province_ID),
    CONSTRAINT UQ_Province_Name UNIQUE (Province_Name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 2: District] 2nd-level administrative unit resolving 2NF dependency
CREATE TABLE District (
    District_ID INT NOT NULL AUTO_INCREMENT,
    District_Name VARCHAR(100) NOT NULL,
    Province_ID INT NOT NULL,
    CONSTRAINT PK_District PRIMARY KEY (District_ID),
    CONSTRAINT FK_District_Province FOREIGN KEY (Province_ID) 
        REFERENCES Province(Province_ID) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 3: Branch] Physical cinema branch establishment
CREATE TABLE Branch (
    Branch_ID INT NOT NULL AUTO_INCREMENT,
    Branch_Name VARCHAR(100) NOT NULL,
    Mall_Name VARCHAR(100) NOT NULL,
    District_ID INT NOT NULL,
    CONSTRAINT PK_Branch PRIMARY KEY (Branch_ID),
    CONSTRAINT FK_Branch_District FOREIGN KEY (District_ID) 
        REFERENCES District(District_ID) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 4: Theater_Type] Projection technology classification (IMAX, 4DX, ScreenX, etc.)
CREATE TABLE Theater_Type (
    Theater_Type_ID INT NOT NULL AUTO_INCREMENT,
    Theater_Type_Name VARCHAR(100) NOT NULL,
    Theater_Type_Description VARCHAR(255),
    CONSTRAINT PK_Theater_Type PRIMARY KEY (Theater_Type_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 5: Sound_System] Acoustic technology specifications (Dolby Atmos, DTS:X, etc.)
CREATE TABLE Sound_System (
    Sound_System_ID INT NOT NULL AUTO_INCREMENT,
    Sound_System_Name VARCHAR(100) NOT NULL,
    Sound_System_Description VARCHAR(255),
    CONSTRAINT PK_Sound_System PRIMARY KEY (Sound_System_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 6: Theater] Physical cinema hall unit inside a specific branch
CREATE TABLE Theater (
    Theater_ID INT NOT NULL AUTO_INCREMENT,
    Theater_Name VARCHAR(100) NOT NULL,
    Theater_Status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    Branch_ID INT NOT NULL,
    Theater_Type_ID INT NOT NULL,
    CONSTRAINT PK_Theater PRIMARY KEY (Theater_ID),
    -- Natural key integrity: Prohibits duplicate theater naming within the same branch
    CONSTRAINT UQ_Theater_Branch_Name UNIQUE (Branch_ID, Theater_Name),
    CONSTRAINT FK_Theater_Branch FOREIGN KEY (Branch_ID) 
        REFERENCES Branch(Branch_ID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT FK_Theater_Type FOREIGN KEY (Theater_Type_ID) 
        REFERENCES Theater_Type(Theater_Type_ID) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 7: Theater_Sound_System] M:N associative entity resolving multi-audio compatibility
CREATE TABLE Theater_Sound_System (
    Theater_ID INT NOT NULL,
    Sound_System_ID INT NOT NULL,
    CONSTRAINT PK_Theater_Sound_System PRIMARY KEY (Theater_ID, Sound_System_ID),
    CONSTRAINT FK_TSS_Theater FOREIGN KEY (Theater_ID) 
        REFERENCES Theater(Theater_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_TSS_Sound FOREIGN KEY (Sound_System_ID) 
        REFERENCES Sound_System(Sound_System_ID) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 8: Seat_Type] Ergonomic category (Normal, Honeymoon, VIP Sofa Bed)
CREATE TABLE Seat_Type (
    Seat_Type_ID INT NOT NULL AUTO_INCREMENT,
    Seat_Type_Name VARCHAR(100) NOT NULL,
    CONSTRAINT PK_Seat_Type PRIMARY KEY (Seat_Type_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 9: Seat] Granular seat layout coordinates within each physical hall
CREATE TABLE Seat (
    Seat_ID INT NOT NULL AUTO_INCREMENT,
    Seat_Row CHAR(2) NOT NULL,
    Seat_Column INT NOT NULL,
    Seat_Status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    Theater_ID INT NOT NULL,
    Seat_Type_ID INT NOT NULL,
    CONSTRAINT PK_Seat PRIMARY KEY (Seat_ID),
    CONSTRAINT CHK_Seat_Column CHECK (Seat_Column > 0),
    -- Enforces Cartesian plane coordinate integrity: Prevents spatial collision
    CONSTRAINT UQ_Seat_Position UNIQUE (Theater_ID, Seat_Row, Seat_Column),
    -- Composite superkey exposed for declarative down-stream referential constraints
    CONSTRAINT UQ_Seat_ID_Theater UNIQUE (Seat_ID, Theater_ID),
    CONSTRAINT FK_Seat_Theater FOREIGN KEY (Theater_ID) 
        REFERENCES Theater(Theater_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_Seat_Seat_Type FOREIGN KEY (Seat_Type_ID) 
        REFERENCES Seat_Type(Seat_Type_ID) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- SECTION 2: MOVIE METADATA, PRODUCTION & ATTRIBUTION GRAPH
-- Fully normalized entity network supporting multiple directors and re-release lifecycles.
-- ============================================================================

-- [Entity 10: Studio] Film distribution and production entities
CREATE TABLE Studio (
    Studio_ID INT NOT NULL AUTO_INCREMENT,
    Studio_Name VARCHAR(150) NOT NULL,
    Studio_Description VARCHAR(255),
    Studio_Country VARCHAR(100) NOT NULL,
    CONSTRAINT PK_Studio PRIMARY KEY (Studio_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 11: Genre] Standard cinematic classification categories
CREATE TABLE Genre (
    Genre_ID INT NOT NULL AUTO_INCREMENT,
    Genre_Name VARCHAR(100) NOT NULL,
    Genre_Description VARCHAR(255),
    CONSTRAINT PK_Genre PRIMARY KEY (Genre_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 12: Language] Audio and subtitle linguistic descriptors
CREATE TABLE Language (
    Language_ID INT NOT NULL AUTO_INCREMENT,
    Language_Name VARCHAR(100) NOT NULL,
    Language_Code VARCHAR(10),
    CONSTRAINT PK_Language PRIMARY KEY (Language_ID),
    CONSTRAINT UQ_Language_Name UNIQUE (Language_Name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 13: Movie] Canonical movie entity containing immutable core metadata
CREATE TABLE Movie (
    Movie_ID INT NOT NULL AUTO_INCREMENT,
    Title VARCHAR(255) NOT NULL,
    Poster_Image VARCHAR(500),
    Movie_Synopsis TEXT,
    Movie_Duration INT NOT NULL,
    Original_Release_Date DATE NOT NULL,
    Age_Rating VARCHAR(10) NOT NULL,
    CONSTRAINT PK_Movie PRIMARY KEY (Movie_ID),
    CONSTRAINT CHK_Movie_Duration CHECK (Movie_Duration > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 14: Movie_Release] Temporal release ledger decouples original releases from re-releases
CREATE TABLE Movie_Release (
    Release_ID INT NOT NULL AUTO_INCREMENT,
    Movie_ID INT NOT NULL,
    Release_Date DATE NOT NULL,
    -- Tracks distinct theatrical deployment windows (e.g. Original, Remastered, Anniversary)
    Release_Edition VARCHAR(100) NOT NULL DEFAULT 'ORIGINAL',
    Release_Note VARCHAR(255),
    CONSTRAINT PK_Movie_Release PRIMARY KEY (Release_ID),
    CONSTRAINT FK_Release_Movie FOREIGN KEY (Movie_ID) 
        REFERENCES Movie(Movie_ID) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 15: Movie_Studio] M:N bridge resolving multi-studio co-productions
CREATE TABLE Movie_Studio (
    Movie_ID INT NOT NULL,
    Studio_ID INT NOT NULL,
    CONSTRAINT PK_Movie_Studio PRIMARY KEY (Movie_ID, Studio_ID),
    CONSTRAINT FK_MS_Movie FOREIGN KEY (Movie_ID) 
        REFERENCES Movie(Movie_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_MS_Studio FOREIGN KEY (Studio_ID) 
        REFERENCES Studio(Studio_ID) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 16: Movie_Genre_Details] M:N bridge supporting multi-genre classifications
CREATE TABLE Movie_Genre_Details (
    Movie_ID INT NOT NULL,
    Genre_ID INT NOT NULL,
    CONSTRAINT PK_Movie_Genre_Details PRIMARY KEY (Movie_ID, Genre_ID),
    CONSTRAINT FK_MGD_Movie FOREIGN KEY (Movie_ID) 
        REFERENCES Movie(Movie_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_MGD_Genre FOREIGN KEY (Genre_ID) 
        REFERENCES Genre(Genre_ID) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 17: Person] Global cast & crew registry
CREATE TABLE Person (
    Person_ID INT NOT NULL AUTO_INCREMENT,
    First_Name VARCHAR(100) NOT NULL,
    Last_Name VARCHAR(100) NOT NULL,
    CONSTRAINT PK_Person PRIMARY KEY (Person_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 18: Movie_Person_Role] Polymorphic credit mapping engine
-- Dynamically handles multiple directors, co-directors, and actors without structural alteration
CREATE TABLE Movie_Person_Role (
    Movie_Person_Role_ID INT NOT NULL AUTO_INCREMENT,
    Movie_ID INT NOT NULL,
    Person_ID INT NOT NULL,
    Role_Type VARCHAR(50) NOT NULL, -- Domain: 'Director', 'Actor', 'Screenplay', etc.
    Character_Name VARCHAR(150) NOT NULL DEFAULT '',
    CONSTRAINT PK_Movie_Person_Role PRIMARY KEY (Movie_Person_Role_ID),
    -- Idempotent credit protection: Prevents duplicate attributions
    CONSTRAINT UQ_MPR_Credit UNIQUE (Movie_ID, Person_ID, Role_Type, Character_Name),
    CONSTRAINT CHK_MPR_Role CHECK (CHAR_LENGTH(TRIM(Role_Type)) > 0),
    CONSTRAINT FK_MPR_Movie FOREIGN KEY (Movie_ID) 
        REFERENCES Movie(Movie_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_MPR_Person FOREIGN KEY (Person_ID) 
        REFERENCES Person(Person_ID) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- SECTION 3: WEB GUEST CHECKOUT & LOYALTY SUBSYSTEM (M GEN / M PASS)
-- Implements frictionless web checkouts and strict membership policy enforcement.
-- ============================================================================

-- [Entity 19: Customer] Frictionless guest checkout record (No password hashing overhead)
CREATE TABLE Customer (
    Customer_ID INT NOT NULL AUTO_INCREMENT,
    Customer_FirstName VARCHAR(50) NOT NULL,
    Customer_LastName VARCHAR(50) NOT NULL,
    Email VARCHAR(255) NOT NULL,  -- Primary digital delivery route for E-Tickets / QR
    Phone VARCHAR(20) NOT NULL,   -- Operational fallback route for transactional SMS
    Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT PK_Customer PRIMARY KEY (Customer_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 20: Membership_Tier] Tiering configuration engine
CREATE TABLE Membership_Tier (
    Tier_ID INT NOT NULL AUTO_INCREMENT,
    Tier_Code VARCHAR(30) NOT NULL UNIQUE,
    Tier_Name VARCHAR(100) NOT NULL,
    -- Strictly classifies whether the card accumulates points (M_GEN) or is unlimited pass (M_PASS)
    Tier_Type ENUM('M_GEN', 'M_PASS') NOT NULL,
    Points_Per_Baht DECIMAL(5,2) DEFAULT 0.05, -- Default accrual formula: 20 THB spent = 1 Point
    Discount_Rate DECIMAL(5,2) DEFAULT 0.00,
    CONSTRAINT PK_Membership_Tier PRIMARY KEY (Tier_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 21: Member_Card] Physical/virtual membership credential verification registry
CREATE TABLE Member_Card (
    Card_ID INT NOT NULL AUTO_INCREMENT,
    Card_Number VARCHAR(20) NOT NULL UNIQUE,     -- Verified during checkout for entitlement validation
    Cardholder_FirstName VARCHAR(50) NOT NULL,
    Cardholder_LastName VARCHAR(50) NOT NULL,
    Cardholder_Phone VARCHAR(20) NOT NULL,
    Tier_ID INT NOT NULL,
    Start_Date DATE NOT NULL,
    Expiry_Date DATE NOT NULL,
    Points_Balance INT NOT NULL DEFAULT 0,       -- Point balance register for M Gen rewards
    Card_Status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT PK_Member_Card PRIMARY KEY (Card_ID),
    CONSTRAINT CHK_Member_Card_Dates CHECK (Expiry_Date > Start_Date),
    CONSTRAINT FK_Card_Tier FOREIGN KEY (Tier_ID) 
        REFERENCES Membership_Tier(Tier_ID) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 22: Member_Pass_Redemption] Strict M Pass entitlement quota enforcement
-- Architectural Guarantee: Enforces "1 Ticket Per Movie per Card" at the RDBMS constraint level
CREATE TABLE Member_Pass_Redemption (
    Redemption_ID INT NOT NULL AUTO_INCREMENT,
    Card_ID INT NOT NULL,
    Movie_ID INT NOT NULL,
    Showtime_ID INT NOT NULL,
    Redeemed_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT PK_MPass_Redemption PRIMARY KEY (Redemption_ID),
    -- HARD CONSTRAINT: Database-level guarantee preventing duplicate redemptions for identical movies
    CONSTRAINT UQ_Card_Movie_Once UNIQUE (Card_ID, Movie_ID),
    CONSTRAINT FK_Redeem_Card FOREIGN KEY (Card_ID) 
        REFERENCES Member_Card(Card_ID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT FK_Redeem_Movie FOREIGN KEY (Movie_ID) 
        REFERENCES Movie(Movie_ID) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 23: Promotion] Campaign-driven discount rule engine
CREATE TABLE Promotion (
    Promotion_ID INT NOT NULL AUTO_INCREMENT,
    Promotion_Code VARCHAR(50) NOT NULL,
    Promotion_Name VARCHAR(150) NOT NULL,
    Promotion_Description VARCHAR(255),
    Start_DateTime DATETIME NOT NULL,
    End_DateTime DATETIME NOT NULL,
    Discount_Type VARCHAR(10) NOT NULL, -- Enum validation: 'PERCENT', 'FIXED'
    Discount_Value DECIMAL(10,2) NOT NULL,
    Eligibility_Type VARCHAR(20) NOT NULL DEFAULT 'ALL',
    Is_Active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT PK_Promotion PRIMARY KEY (Promotion_ID),
    CONSTRAINT UQ_Promotion_Code UNIQUE (Promotion_Code),
    CONSTRAINT CHK_Promotion_Period CHECK (End_DateTime > Start_DateTime)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- SECTION 4: 4-DIMENSIONAL DYNAMIC PRICING, SCHEDULES & TICKET INVENTORY
-- Comprehensive pricing matrix resolving spatial, temporal, and seat tiering.
-- ============================================================================

-- [Entity 24: Day_Time_Slot] Temporal dimension abstraction for dynamic pricing
-- Fully decouples calendar rules (e.g. Wednesday Movie Day, Morning Shows, Late Night)
CREATE TABLE Day_Time_Slot (
    Day_Time_Slot_ID INT NOT NULL AUTO_INCREMENT,
    Slot_Code VARCHAR(50) NOT NULL UNIQUE,
    Slot_Name VARCHAR(100) NOT NULL,
    Slot_Description VARCHAR(255),
    CONSTRAINT PK_Day_Time_Slot PRIMARY KEY (Day_Time_Slot_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 25: Price] 4-Dimensional Matrix: Branch × Technology × Seating × Temporal
CREATE TABLE Price (
    Price_ID INT NOT NULL AUTO_INCREMENT,
    Branch_ID INT NOT NULL,
    Theater_Type_ID INT NOT NULL,
    Seat_Type_ID INT NOT NULL,
    Day_Time_Slot_ID INT NOT NULL,
    Price_Amount DECIMAL(10,2) NOT NULL,
    Price_Description VARCHAR(100),
    CONSTRAINT PK_Price PRIMARY KEY (Price_ID),
    -- Strict mathematical guarantee: Guarantees deterministic, collision-free price resolution
    CONSTRAINT UQ_Price_Matrix UNIQUE (Branch_ID, Theater_Type_ID, Seat_Type_ID, Day_Time_Slot_ID),
    CONSTRAINT CHK_Price_Amount CHECK (Price_Amount >= 0.00),
    CONSTRAINT FK_Price_Branch FOREIGN KEY (Branch_ID) 
        REFERENCES Branch(Branch_ID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT FK_Price_Theater_Type FOREIGN KEY (Theater_Type_ID) 
        REFERENCES Theater_Type(Theater_Type_ID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT FK_Price_Seat_Type FOREIGN KEY (Seat_Type_ID) 
        REFERENCES Seat_Type(Seat_Type_ID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT FK_Price_Day_Time_Slot FOREIGN KEY (Day_Time_Slot_ID) 
        REFERENCES Day_Time_Slot(Day_Time_Slot_ID) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 26: Showtime] Hall schedule orchestration ledger
CREATE TABLE Showtime (
    Showtime_ID INT NOT NULL AUTO_INCREMENT,
    Start_Time DATETIME NOT NULL,
    End_Time DATETIME NOT NULL,
    Showtime_Status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    Movie_ID INT NOT NULL,
    Theater_ID INT NOT NULL,
    Audio_Language_ID INT NOT NULL,
    Subtitle_Language_ID INT NULL,
    CONSTRAINT PK_Showtime PRIMARY KEY (Showtime_ID),
    CONSTRAINT CHK_Showtime_Time CHECK (End_Time > Start_Time),
    -- Operational integrity: Prevents double-booking schedule overlaps inside the same hall
    CONSTRAINT UQ_Showtime_Theater_Start UNIQUE (Theater_ID, Start_Time),
    -- Superkey exposed for composite referential validation down to Ticket level
    CONSTRAINT UQ_Showtime_ID_Theater UNIQUE (Showtime_ID, Theater_ID),
    CONSTRAINT FK_Showtime_Movie FOREIGN KEY (Movie_ID) 
        REFERENCES Movie(Movie_ID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT FK_Showtime_Theater FOREIGN KEY (Theater_ID) 
        REFERENCES Theater(Theater_ID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT FK_Showtime_Audio FOREIGN KEY (Audio_Language_ID) 
        REFERENCES Language(Language_ID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT FK_Showtime_Subtitle FOREIGN KEY (Subtitle_Language_ID) 
        REFERENCES Language(Language_ID) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 27: Booking] Web reservation transaction session
CREATE TABLE Booking (
    Booking_ID INT NOT NULL AUTO_INCREMENT,
    Booking_DateTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Booking_Status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- Fixed channel identifier as mandated by architectural assignment scope
    Channel_Type VARCHAR(20) NOT NULL DEFAULT 'WEBSITE',
    Customer_ID INT NOT NULL,
    Showtime_ID INT NOT NULL,
    CONSTRAINT PK_Booking PRIMARY KEY (Booking_ID),
    -- Superkey pair exported to validate atomic 1-Showtime-per-Booking consistency
    CONSTRAINT UQ_Booking_ID_Showtime UNIQUE (Booking_ID, Showtime_ID),
    CONSTRAINT FK_Booking_Customer FOREIGN KEY (Customer_ID) 
        REFERENCES Customer(Customer_ID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT FK_Booking_Showtime FOREIGN KEY (Showtime_ID) 
        REFERENCES Showtime(Showtime_ID) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 28: Ticket] Physical ticket ledger with declarative anti-double-booking protection
CREATE TABLE Ticket (
    Ticket_ID INT NOT NULL AUTO_INCREMENT,
    Booking_ID INT NOT NULL,
    Seat_ID INT NOT NULL,
    Showtime_ID INT NOT NULL,
    Theater_ID INT NOT NULL,
    Price_ID INT NOT NULL,
    -- IMMUTABLE FINANCIAL SNAPSHOT: Stores historical purchase price (0.00 for M Pass redemptions).
    -- Crucial for accounting integrity; completely immune to downstream base price alterations.
    Sold_Price DECIMAL(10,2) NOT NULL,
    Promotion_ID INT NULL,
    Member_Card_ID INT NULL,
    CONSTRAINT PK_Ticket PRIMARY KEY (Ticket_ID),
    CONSTRAINT CHK_Ticket_Sold_Price CHECK (Sold_Price >= 0),
    -- RACE CONDITION MITIGATION: Prevents seat double-booking across simultaneous web sessions
    CONSTRAINT UQ_Ticket_Showtime_Seat UNIQUE (Showtime_ID, Seat_ID),
    -- Enforces that all reserved seats belong to the exact same showtime as the parent booking
    CONSTRAINT FK_Ticket_Booking_Showtime FOREIGN KEY (Booking_ID, Showtime_ID) 
        REFERENCES Booking(Booking_ID, Showtime_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    -- Declarative spatial verification: Guarantees that the reserved seat physically exists inside the assigned hall
    CONSTRAINT FK_Ticket_Seat_Theater FOREIGN KEY (Seat_ID, Theater_ID) 
        REFERENCES Seat(Seat_ID, Theater_ID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT FK_Ticket_Showtime_Theater FOREIGN KEY (Showtime_ID, Theater_ID) 
        REFERENCES Showtime(Showtime_ID, Theater_ID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT FK_Ticket_Price FOREIGN KEY (Price_ID) 
        REFERENCES Price(Price_ID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT FK_Ticket_Promotion FOREIGN KEY (Promotion_ID) 
        REFERENCES Promotion(Promotion_ID) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT FK_Ticket_Card FOREIGN KEY (Member_Card_ID) 
        REFERENCES Member_Card(Card_ID) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- SECTION 5: PAYMENT GATEWAY INTEGRATION & RECONCILIATION
-- Enterprise financial transactions with strict idempotency and gateway audit trail.
-- ============================================================================

-- [Entity 29: Payment_Method] Settlement rail types (Credit Card, PromptPay QR, etc.)
CREATE TABLE Payment_Method (
    Payment_Method_ID INT NOT NULL AUTO_INCREMENT,
    Method_Name VARCHAR(50) NOT NULL,
    CONSTRAINT PK_Payment_Method PRIMARY KEY (Payment_Method_ID),
    CONSTRAINT UQ_Payment_Method_Name UNIQUE (Method_Name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 30: Payment_Provider_Account] Merchant sub-account ledger for third-party settlement gateways
CREATE TABLE Payment_Provider_Account (
    Provider_Account_ID INT NOT NULL AUTO_INCREMENT,
    Provider_Name VARCHAR(100) NOT NULL,
    Merchant_Account_Ref VARCHAR(100) NOT NULL,
    CONSTRAINT PK_Payment_Provider_Account PRIMARY KEY (Provider_Account_ID),
    CONSTRAINT UQ_PPA_Account UNIQUE (Provider_Name, Merchant_Account_Ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Entity 31: Payment] Core financial settlement transaction ledger
CREATE TABLE Payment (
    Payment_ID INT NOT NULL AUTO_INCREMENT,
    Paid_Amount DECIMAL(10,2) NOT NULL,
    Payment_DateTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Payment_Status VARCHAR(20) NOT NULL, -- Enum: 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'
    Booking_ID INT NOT NULL,
    Payment_Method_ID INT NOT NULL,
    Provider_Account_ID INT NOT NULL,
    -- DISTRIBUTED IDEMPOTENCY KEY: Enforces safe retries, completely eliminating duplicate charge risks
    Idempotency_Key VARCHAR(64) NOT NULL,
    -- External transaction reference provided by upstream Payment Gateway (e.g. 2C2P, Omise)
    Provider_Transaction_ID VARCHAR(128) NULL,
    CONSTRAINT PK_Payment PRIMARY KEY (Payment_ID),
    CONSTRAINT UQ_Payment_Idempotency UNIQUE (Idempotency_Key),
    CONSTRAINT CHK_Paid_Amount CHECK (Paid_Amount >= 0.00),
    CONSTRAINT FK_Payment_Booking FOREIGN KEY (Booking_ID) 
        REFERENCES Booking(Booking_ID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT FK_Payment_Method FOREIGN KEY (Payment_Method_ID) 
        REFERENCES Payment_Method(Payment_Method_ID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT FK_Payment_Provider FOREIGN KEY (Provider_Account_ID) 
        REFERENCES Payment_Provider_Account(Provider_Account_ID) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SECTION 6: MOVIE REVIEWS
-- ============================================================================


CREATE TABLE Movie_Review (
    Review_ID INT NOT NULL AUTO_INCREMENT,
    Movie_ID INT NOT NULL,
    Source_ID INT NOT NULL,
    Raw_Score VARCHAR(20) NOT NULL,
    -- 0..100; NULL means conversion is not yet defined, NOT a zero score.
    Normalized_Score DECIMAL(5,2),
    Source_URL VARCHAR(1000),
    Updated_At DATETIME NOT NULL COMMENT 'UTC; when the score was checked at source',
    CONSTRAINT PK_Movie_Review PRIMARY KEY (Review_ID),
    CONSTRAINT UQ_Movie_Review_Source UNIQUE (Movie_ID, Source_ID),
    CONSTRAINT FK_Movie_Review_Movie FOREIGN KEY (Movie_ID) REFERENCES Movie(Movie_ID),
    CONSTRAINT FK_Movie_Review_Source FOREIGN KEY (Source_ID) REFERENCES Review_Source(Source_ID),
    CONSTRAINT CHK_Movie_Review_Raw CHECK (CHAR_LENGTH(TRIM(Raw_Score)) > 0),
    CONSTRAINT CHK_Movie_Review_Normalized CHECK (
        Normalized_Score IS NULL OR Normalized_Score BETWEEN 0 AND 100
    ),
    CONSTRAINT CHK_Movie_Review_URL CHECK (
        Source_URL IS NULL OR CHAR_LENGTH(TRIM(Source_URL)) > 0
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed only identified sources. Do not guess the third logo's identity or grade rule.
INSERT INTO Review_Source
    (Source_Code, Source_Name, Website_URL, Score_Type, Score_Max, Normalization_Rule)
VALUES
    ('IMDB', 'IMDb', 'https://www.imdb.com', 'DECIMAL', 10,
     'User rating: parse decimal 1..10; normalized = raw / 10 * 100.'),
    ('ROTTEN_TOMATOES', 'Rotten Tomatoes', 'https://www.rottentomatoes.com', 'PERCENT', 100,
     'Tomatometer only: accept integer 0..100 with optional trailing percent sign; normalized = parsed value.');

-- ============================================================================
-- SECTION 7: REAL-TIME ANALYTICAL VIEWS (BUSINESS INTELLIGENCE & REPORTING)
-- Fully non-redundant derived reporting preserving strict 3NF database architecture.
-- ============================================================================

-- [Analytical View 1: Booking Volume & Revenue Statistics]
-- Real-time aggregations of validated web transactions per calendar day
CREATE VIEW View_Booking_Statistics AS
SELECT 
    DATE(b.Booking_DateTime) AS Booking_Date,
    COUNT(DISTINCT b.Booking_ID) AS Total_Booking_Orders,
    COUNT(t.Ticket_ID) AS Total_Seats_Booked,
    SUM(t.Sold_Price) AS Total_Sales_Revenue
FROM Booking b
JOIN Ticket t ON b.Booking_ID = t.Booking_ID
WHERE b.Booking_Status = 'CONFIRMED'
GROUP BY DATE(b.Booking_DateTime);

-- [Analytical View 2: Membership Redemption & Usage Analytics]
-- Comparative reporting between loyalty accrual (M Gen) vs subscription passes (M Pass)
CREATE VIEW View_Membership_Usage_Statistics AS
SELECT 
    mt.Tier_Name,
    mt.Tier_Type,
    COUNT(DISTINCT mc.Card_ID) AS Total_Active_Cards,
    COUNT(t.Ticket_ID) AS Total_Tickets_Claimed,
    SUM(t.Sold_Price) AS Total_Revenue_Generated
FROM Membership_Tier mt
JOIN Member_Card mc ON mt.Tier_ID = mc.Tier_ID
LEFT JOIN Ticket t ON mc.Card_ID = t.Member_Card_ID
GROUP BY mt.Tier_ID, mt.Tier_Name, mt.Tier_Type;

-- [Analytical View 3: Projection Technology Popularity Index]
-- Evaluates capacity utilization and consumer demand across specialized theater formats
CREATE VIEW View_Top_Theater_Types AS
SELECT 
    tt.Theater_Type_ID,
    tt.Theater_Type_Name,
    COUNT(t.Ticket_ID) AS Total_Tickets_Sold,
    SUM(t.Sold_Price) AS Total_Revenue
FROM Ticket t
JOIN Showtime s ON t.Showtime_ID = s.Showtime_ID
JOIN Theater th ON s.Theater_ID = th.Theater_ID
JOIN Theater_Type tt ON th.Theater_Type_ID = tt.Theater_Type_ID
JOIN Booking b ON t.Booking_ID = b.Booking_ID
WHERE b.Booking_Status = 'CONFIRMED'
GROUP BY tt.Theater_Type_ID, tt.Theater_Type_Name
ORDER BY Total_Tickets_Sold DESC;

-- [Analytical View 4: Monthly Box Office & Popularity Ranking]
-- Calculates rank trajectories per calendar month using non-sparse windowing (DENSE_RANK)
CREATE VIEW View_Monthly_Movie_Ranking AS
SELECT 
    DATE_FORMAT(b.Booking_DateTime, '%Y-%m') AS Month_Year,
    m.Movie_ID,
    m.Title AS Movie_Title,
    COUNT(t.Ticket_ID) AS Total_Tickets_Sold,
    SUM(t.Sold_Price) AS Total_Revenue,
    DENSE_RANK() OVER (
        PARTITION BY DATE_FORMAT(b.Booking_DateTime, '%Y-%m') 
        ORDER BY COUNT(t.Ticket_ID) DESC, SUM(t.Sold_Price) DESC
    ) AS Monthly_Popularity_Rank
FROM Booking b
JOIN Ticket t ON b.Booking_ID = t.Booking_ID
JOIN Showtime s ON t.Showtime_ID = s.Showtime_ID
JOIN Movie m ON s.Movie_ID = m.Movie_ID
WHERE b.Booking_Status = 'CONFIRMED'
GROUP BY Month_Year, m.Movie_ID, m.Title;

-- Optional query view; no duplicate summary column is stored in Movie.
-- Equal weight per available, convertible source. Do not count missing scores as zero.
CREATE VIEW V_Movie_Review_Summary AS
SELECT m.Movie_ID,
       COUNT(r.Review_ID) AS Source_Count,
       COUNT(r.Normalized_Score) AS Normalized_Source_Count,
       ROUND(SUM(r.Normalized_Score) * 1.0 / NULLIF(COUNT(r.Normalized_Score), 0), 2)
           AS Average_Score_100
FROM Movie m
LEFT JOIN Movie_Review r ON r.Movie_ID = m.Movie_ID
GROUP BY m.Movie_ID;