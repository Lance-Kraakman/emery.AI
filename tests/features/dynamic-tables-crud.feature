Feature: Dynamic Tables and CRUD Operations
  As a user in an organization
  I want to create and manage dynamic tables with custom fields
  So that I can store and organize data according to my specific needs

  Background:
    Given I am signed in to organization "Data Management Corp"
    And I have "Admin" permissions in the organization

  Scenario: Creating a dynamic table with basic fields
    Given I am on the dashboard
    When I click "Create New Table"
    And I enter table name "Customers"
    And I click "Create Table"
    Then I should see "Customers" in my table list
    And the table should be created with a unique database name
    And the table should have default "id", "created_at", and "updated_at" fields

  Scenario: Adding various field types to a table
    Given I have a table named "Products"
    When I select the "Products" table
    And I add a field with the following details:
      | Name     | Type    | Required |
      | "Name"   | text    | true     |
    And I add a field with the following details:
      | Name     | Type    | Required |
      | "Price"  | number  | true     |
    And I add a field with the following details:
      | Name        | Type    | Required |
      | "Available" | boolean | false    |
    And I add a field with the following details:
      | Name       | Type | Required |
      | "Email"    | email| false    |
    And I add a field with the following details:
      | Name       | Type | Required |
      | "Website"  | url  | false    |
    And I add a field with the following details:
      | Name          | Type | Required |
      | "Launch Date" | date | false    |
    Then I should see all these fields in the table schema
    And each field should be created with the correct database column type
    And the field names should be converted to "field_{id}" format in the database

  Scenario: Creating relational fields between tables
    Given I have tables "Orders" and "Customers"
    When I select the "Orders" table
    And I add a relation field:
      | Name              | Type     | Related Table |
      | "Customer"        | relation | "Customers"   |
    Then the field should be created as a JSONB column with GIN index
    And I should be able to link orders to customer records

  Scenario: Adding data to a dynamic table
    Given I have a "Products" table with fields:
      | Name        | Type    |
      | "Name"      | text    |
      | "Price"     | number  |
      | "Available" | boolean |
    When I add a new row with data:
      | Field       | Value    |
      | "Name"      | "Laptop" |
      | "Price"     | 999      |
      | "Available" | true     |
    Then the row should be saved with a generated UUID
    And I should see the row in the table view
    And the data should be stored in the correct "field_{id}" columns

  Scenario: Updating existing table data
    Given I have a "Products" table with existing data:
      | Name      | Price | Available |
      | "Laptop"  | 999   | true      |
      | "Mouse"   | 25    | false     |
    When I edit the "Laptop" row and change:
      | Field   | New Value |
      | "Price" | 899       |
    And I save the changes
    Then the row should be updated in the database
    And I should see the new price reflected in the table view

  Scenario: Deleting table data
    Given I have a "Products" table with a row for "Old Product"
    When I select the "Old Product" row
    And I click "Delete Row"
    And I confirm the deletion
    Then the row should be removed from the database
    And it should no longer appear in the table view

  Scenario: Required field validation
    Given I have a "Customers" table with a required "Name" field
    When I try to add a new row without providing a "Name"
    Then I should see a validation error
    And the row should not be saved
    When I provide a "Name" and submit
    Then the row should be saved successfully

  Scenario: Field type validation
    Given I have a "Products" table with a "Price" number field
    When I try to enter "abc" in the "Price" field
    Then I should see a validation error indicating invalid number format
    When I enter "123.45" in the "Price" field
    Then the value should be accepted and saved

  Scenario: Email field validation
    Given I have a "Contacts" table with an "Email" email field
    When I try to enter "invalid-email" in the "Email" field
    Then I should see an email format validation error
    When I enter "user@example.com" in the "Email" field
    Then the value should be accepted and saved

  Scenario: URL field validation
    Given I have a "Companies" table with a "Website" url field
    When I try to enter "not-a-url" in the "Website" field
    Then I should see a URL format validation error
    When I enter "https://example.com" in the "Website" field
    Then the value should be accepted and saved

  Scenario: Date field handling
    Given I have a "Events" table with a "Date" date field
    When I select a date from the date picker
    Then the date should be stored in the correct format
    And it should be displayed properly in the table view

  Scenario: Boolean field handling
    Given I have a "Tasks" table with a "Completed" boolean field
    When I toggle the boolean field on
    Then it should be saved as true in the database
    When I toggle it off
    Then it should be saved as false in the database

  Scenario: Relation field data storage and retrieval
    Given I have "Orders" table linked to "Customers" table
    And I have existing customer records
    When I create a new order and select a customer
    Then the customer relationship should be stored as JSONB
    And I should be able to see the linked customer information in the order view

Feature: Dynamic Table Schema Management
  As a table administrator
  I want to modify table schemas after creation
  So that I can adapt to changing requirements

  Scenario: Adding fields to existing table with data
    Given I have a "Users" table with existing user records
    When I add a new field "Department" of type text
    Then the field should be added to the table schema
    And existing rows should show null/empty for the new field
    And new rows should be able to include the "Department" field

  Scenario: Deleting fields from a table
    Given I have a "Products" table with fields including "Old Field"
    When I delete the "Old Field"
    Then the field should be removed from the table schema
    And the corresponding database column should be dropped
    And existing data should be preserved for remaining fields

  Scenario: Field modification constraints
    Given I have a "Customers" table with a "Name" field containing data
    When I try to change the "Name" field from text to number type
    Then I should see a warning about potential data loss
    And I should be able to proceed with confirmation
    Or cancel the operation

  Scenario: Required field constraints on existing data
    Given I have a "Products" table with some rows having empty "Description"
    When I try to make "Description" a required field
    Then I should see a validation error
    And I should be prompted to either:
      - Fill in missing values first
      - Or make the field not required

Feature: Table and Data Organization
  As a data manager
  I want to organize and view my table data efficiently
  So that I can find and work with information quickly

  Scenario: Table listing and organization
    Given I have multiple tables in my organization:
      | Name        | Created Date |
      | "Customers" | 2024-01-15   |
      | "Orders"    | 2024-01-20   |
      | "Products"  | 2024-01-25   |
    When I view my table list
    Then I should see all tables sorted by creation date (newest first)
    And each table should show its name and creation date
    And I should be able to click on any table to open it

  Scenario: Table data pagination and filtering
    Given I have a "Customers" table with 1000+ customer records
    When I open the table
    Then I should see the data paginated with 50 rows per page
    And I should see pagination controls
    When I search for "John" in the table
    Then I should see only rows where any field contains "John"

  Scenario: Sorting table data
    Given I have a "Products" table with price and name columns
    When I click on the "Price" column header
    Then the data should be sorted by price (ascending)
    When I click the "Price" header again
    Then the data should be sorted by price (descending)

  Scenario: Bulk operations on table data
    Given I have a "Products" table with multiple rows
    When I select multiple rows using checkboxes
    And I click "Delete Selected"
    And I confirm the bulk deletion
    Then all selected rows should be removed from the table
    And I should see a confirmation message

Feature: Data Import and Export
  As a data manager
  I want to import and export table data
  So that I can migrate data and create backups

  Scenario: CSV data import
    Given I have an empty "Contacts" table with email and name fields
    When I upload a CSV file with contact data:
      | Name       | Email              |
      | "John Doe" | "john@example.com" |
      | "Jane Doe" | "jane@example.com" |
    Then the data should be imported into the table
    And I should see 2 new rows in the "Contacts" table

  Scenario: CSV data export
    Given I have a "Products" table with product data
    When I click "Export to CSV"
    Then I should download a CSV file
    And the file should contain all table data with proper headers
    And field names should be human-readable (not field_123 format)

  Scenario: JSON data export
    Given I have a "Orders" table with relational data
    When I export the data as JSON
    Then the export should include all fields including relation data
    And the JSON structure should preserve data types
    And relation fields should include linked record information