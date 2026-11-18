Feature: Dados de correlação entre turmas
  As a professor
  I want to visualizar correlações entre os resultados de turmas
  So that eu possa identificar padrões de aprendizagem

  # Estes cenários exercitam a área de correlação disponível na página inicial.
  # A interface permite selecionar duas ou mais turmas e duas variáveis diferentes.
  # Os dados são agregados por turma; não há distinção entre período atual e anterior.

  Scenario: Vendo uma correlação quando há turmas com dados suficientes
    Given I am in the correlation area of the professor homepage
    And there are the following classes with evaluation data:
      | class   | Requirements | Design |
      | 2024.1  | MANA         | MANA   |
      | 2024.2  | MPA          | MPA    |
      | 2024.3  | MA           | MA     |
    When I choose classes "2024.1", "2024.2" and "2024.3" for comparison
    And I choose the variables "Requirements" and "Design" for comparison
    And I select the option responsible for viewing correlation data outputs
    Then I see one correlation result for "Requirements" and "Design"
    And the result says that 3 classes were analyzed
    And the result contains the coefficient "1.00"
    And the result is presented as a natural-language statement

    # Cálculo: Requirements = [1, 2, 3], Design = [1, 2, 3].
    # Pearson r = 1,00; portanto, a interface apresenta uma correlação positiva forte.

  Scenario: Vendo uma correlação negativa quando os resultados variam em sentidos opostos
    Given I am in the correlation area of the professor homepage
    And there are the following classes with evaluation data:
      | class   | Requirements | Design |
      | 2024.1  | MANA         | MA     |
      | 2024.2  | MPA          | MPA    |
      | 2024.3  | MA           | MANA   |
    When I choose classes "2024.1", "2024.2" and "2024.3" for comparison
    And I choose the variables "Requirements" and "Design" for comparison
    And I select the option responsible for viewing correlation data outputs
    Then I see one correlation result for "Requirements" and "Design"
    And the result contains the coefficient "-1.00"
    And the result is presented as a natural-language statement

    # Cálculo: Requirements = [1, 2, 3], Design = [3, 2, 1].
    # Pearson r = -1,00; portanto, a interface apresenta uma correlação negativa forte.

  Scenario: Não exibindo resultado quando nenhuma turma é selecionada
    Given I am in the correlation area of the professor homepage
    And there are at least two classes available for selection
    And no class is selected
    And the variables "Requirements" and "Design" are selected
    Then the system does not allow me to request correlation data
    And no correlation result is visible

  Scenario: Não exibindo resultado quando apenas uma turma é selecionada
    Given I am in the correlation area of the professor homepage
    And the class "2024.1" is available for selection
    And only the class "2024.1" is selected
    And the variables "Requirements" and "Design" are selected
    Then the system does not allow me to request correlation data
    And no correlation result is visible

  Scenario: Não permitindo selecionar a mesma variável duas vezes
    Given I am in the correlation area of the professor homepage
    And there are at least two classes available for selection
    And the classes "2024.1" and "2024.2" are selected
    When I choose "Requirements" as both comparison variables
    Then the system does not allow me to request correlation data
    And no correlation result is visible

  Scenario: Informando que não há dados suficientes para as turmas selecionadas
    Given I am in the correlation area of the professor homepage
    And the classes "2024.1" and "2024.2" have no evaluations for "Requirements" or "Design"
    When I choose classes "2024.1" and "2024.2" for comparison
    And I choose the variables "Requirements" and "Design" for comparison
    And I select the option responsible for viewing correlation data outputs
    Then I see the message "Não há dados suficientes para construir correlações com as seleções atuais."
    And no correlation result is visible
