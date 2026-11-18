@report-gui
Feature: Class Report
    As a professor
    I want to see the performance report of one of my classes
    So that I can see how many of my students passed or failed and reflect on my teaching method.

Scenario: Successful generation of class report with student performance metrics
    Given the class "ESS 2026.2" has the following students and academic statuses:
        | student     | final grade | status        |
        | Ana Souza   | 3.0         | Not Approved  |
        | João Silva  | 8.5         | Approved      |
        | Maria Costa | 7.0         | Approved      |
        | Pedro Alves | 5.0         | In Final Exam |
    And I am at the "Classes" page
    When I view the performance report for class "ESS 2026.2"
    Then I should see the performance report for class "ESS 2026.2"
    And the report should display the students by status:
        | status        | students | percentage |
        | Approved      | 2        | 50%        |
        | In Final Exam | 1        | 25%        |
        | Not Approved  | 1        | 25%        |
    And the report should list the students with their final grades and statuses:
        | student     | final grade | status        |
        | Ana Souza   | 3.0         | Not Approved  |
        | João Silva  | 8.5         | Approved      |
        | Maria Costa | 7.0         | Approved      |
        | Pedro Alves | 5.0         | In Final Exam |

Scenario: Attempt to view report for a class with no graded students
    Given the class "ESS 2026.1" has no student grades recorded in the system
    And I am at the "Classes" page
    When I view the performance report for class "ESS 2026.1"
    Then I should see the error message "Relatório de desempenho indisponível para turmas sem notas registradas"
    And I do not see the performance report for class "ESS 2026.1"

Scenario: Change the visualization chart format for the class performance report
    Given the class "ESS 2025.2" has performance records in the system
    And I am viewing the performance report for class "ESS 2025.2" as a "bar chart"
    When I request to view the performance report as a "pie chart"
    Then I should see the performance report displayed as a "pie chart"
    And the chart should accurately represent the proportions of performance statuses for class "ESS 2025.2"
