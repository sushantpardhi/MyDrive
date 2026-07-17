import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import DashboardFilters from "./DashboardFilters";

describe("DashboardFilters", () => {
  it("includes the User role filter and emits it through onFilterChange", () => {
    const onFilterChange = jest.fn();

    render(
      <DashboardFilters
        filters={{ startDate: null, endDate: null, role: "all" }}
        onFilterChange={onFilterChange}
      />,
    );

    expect(screen.getByRole("option", { name: "User" })).toBeInTheDocument();

    const [dateRangeSelect, roleSelect] = screen.getAllByRole("combobox");

    fireEvent.change(dateRangeSelect, { target: { value: "all" } });
    fireEvent.change(roleSelect, { target: { value: "user" } });

    expect(onFilterChange).toHaveBeenLastCalledWith({ role: "user" });
  });
});